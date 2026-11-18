#!/usr/bin/env python3
import argparse
import base64
import concurrent.futures
import hashlib
import io
import json
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = 'https://w2i.games.wanmei.com/info.shtml'
EXTRA_SEEDS = [
    ('装备道具', '普通武器', '武器－刀剑及其他类别', 'https://w2i.wanmei.com/djzb/zb/20091015/29859.shtml'),
    ('装备道具', '魂石专题', '魂石专题', 'https://w2i.wanmei.com/hd/wi_itemsdemo/soulstone.htm'),
]
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'wbr'}
SKIP_TAGS = {'script', 'style', 'noscript', 'form', 'input', 'button', 'select', 'textarea'}
ALLOWED_TAGS = {'p', 'div', 'span', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'blockquote', 'pre', 'code', 'a', 'img'}
PAGE_SUFFIX = {'.htm', '.html', '.shtml'}
ASSET_SUFFIX = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.js', '.css', '.xml', '.json', '.txt', '.swf'}
LOCK = threading.Lock()
LAST_REQUEST = 0.0


def stamp():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def normalize(url, base=DIRECTORY):
    url = urllib.parse.urljoin(base, url.strip().replace('\\/', '/'))
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password:
        return None
    host = parsed.hostname.lower()
    if host == 'w2i.games.wanmei.com':
        host = 'w2i.wanmei.com'
    scheme = 'https' if host in {'w2i.wanmei.com', 'event51.wanmei.com'} else parsed.scheme
    path = urllib.parse.quote(parsed.path or '/', safe="/%:@!$&'()*+,;=-._~")
    query = urllib.parse.quote(parsed.query, safe="%:@!$&'()*+,;=/?-._~")
    return urllib.parse.urlunsplit((scheme, host, path, query, ''))


def identity(url):
    return hashlib.sha256(url.encode()).hexdigest()[:20]


def allowed_host(url):
    host = urllib.parse.urlsplit(url).hostname or ''
    return host == 'wanmei.com' or host.endswith('.wanmei.com')


def page_reason(url):
    parsed = urllib.parse.urlsplit(url)
    host, path = parsed.hostname or '', parsed.path.lower()
    if not allowed_host(url):
        return '非完美官方域名，仅保留链接'
    if host.startswith(('passport.', 'pay.', 'cs.', 'bbs.', 'vip.', 'esales.')):
        return '账号、支付、客服或社区，不采集'
    if any(part in path for part in ['/download/', '/phone_reg', '/login', '/register', '/iconupload/', '/newpay', '/password', '/zhanghao/', '/mobiletoken/']):
        return '账号操作、客户端或上传入口，不采集'
    if host.startswith(('event', 'events')) and '/w2i/' not in path:
        return '其他游戏专题，不采集'
    if host not in {'w2i.wanmei.com', 'event51.wanmei.com', 'event.wanmei.com', 'event52.wanmei.com'}:
        return '非本游戏资料站，仅保留链接'
    if path in {'/', '/main.htm', '/main.html', '/index.shtml', '/info.shtml'} or path.startswith('/news/') and not re.search(r'/\d{8}/\d+\.shtml$', path):
        return '全站导航或新闻公告列表，不递归展开'
    suffix = Path(path).suffix
    if suffix not in PAGE_SUFFIX and not path.endswith('/'):
        return '非静态资料页或需动态服务，仅保留链接'
    return None


class Node:
    def __init__(self, tag='', attrs=None, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs or []), parent, []

    def walk(self, tag=None):
        if tag is None or self.tag == tag:
            yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk(tag)

    def text(self):
        if self.tag in SKIP_TAGS:
            return ''
        content = ''.join(child.text() if isinstance(child, Node) else child for child in self.children)
        return content + ('\n' if self.tag in {'p', 'div', 'br', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'hr'} else ' ' if self.tag in {'td', 'th'} else '')

    def classes(self):
        return self.attrs.get('class', '').split()


class Tree(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node('document')
        self.current = self.root
        self.feed(html)

    def close_optional(self, tags):
        node = self.current
        while node.parent:
            if node.tag in tags:
                self.current = node.parent
                return
            if node.tag in {'table', 'ul', 'ol'}:
                return
            node = node.parent

    def handle_starttag(self, tag, attrs):
        if tag in {'td', 'th'}:
            self.close_optional({'td', 'th'})
        elif tag == 'tr':
            self.close_optional({'td', 'th'})
            self.close_optional({'tr'})
        elif tag == 'li':
            self.close_optional({'li'})
        elif tag == 'p':
            self.close_optional({'p'})
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in VOID:
            self.current = node

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, data):
        self.current.children.append(data)


def clean_text(text):
    return '\n'.join(line for line in (re.sub(r'[\t \u00a0\u3000]+', ' ', line).strip() for line in text.splitlines()) if line)


def body_scope(tree):
    articles = [node for node in tree.root.walk() if 'rep_text' in node.classes()]
    if articles:
        return articles
    candidates = [node for node in tree.root.walk() if node.attrs.get('id') == 'pub_main']
    scope = candidates[0] if candidates else next(tree.root.walk('body'), tree.root)
    removed_ids = {'menu', 'nav', 'pub_lr', 'flart_regbar', 'regbox', 'showdiv', 'showsecond', 'fastreg_box2'}
    removed_classes = {'topNavwrap', 'topNav', 'secnav', 'erinav', 'rep_foot', 'inc_bot_info', 'wm-public', 'winfo_tab', 'wkf', 'share_box'}
    for node in list(scope.walk()):
        if node.parent and (node.attrs.get('id') in removed_ids or removed_classes.intersection(node.classes())):
            node.parent.children.remove(node)
    return [scope]


def collect_tables(scopes):
    result = []
    for scope in scopes:
        for table in scope.walk('table'):
            rows = []
            for row in table.walk('tr'):
                parent = row.parent
                while parent and parent.tag != 'table':
                    parent = parent.parent
                if parent is not table:
                    continue
                cells = []
                for cell in row.children:
                    if isinstance(cell, Node) and cell.tag in {'td', 'th'}:
                        cells.append({'text': clean_text(cell.text()), 'rowspan': cell.attrs.get('rowspan', '1'), 'colspan': cell.attrs.get('colspan', '1')})
                if cells:
                    rows.append(cells)
            if rows:
                result.append({'rows': rows})
    return result


def references(scopes, url, topic):
    links, assets = {}, {}
    for scope in scopes:
        for node in scope.walk():
            if node.tag in {'a', 'area'}:
                dest = normalize(node.attrs.get('href', ''), url) if node.attrs.get('href') else None
                if dest:
                    links[dest] = {'url': dest, 'label': clean_text(node.text()) or node.attrs.get('alt', ''), 'kind': 'image-map' if node.tag == 'area' else 'anchor'}
            if node.tag in {'iframe', 'frame'}:
                dest = normalize(node.attrs.get('src', ''), url) if node.attrs.get('src') else None
                if dest:
                    links[dest] = {'url': dest, 'label': node.attrs.get('title', ''), 'kind': 'iframe'}
            if node.tag in {'img', 'embed', 'script', 'source', 'object', 'param'} or node.tag == 'link' and 'stylesheet' in node.attrs.get('rel', '').lower().split():
                attr = 'href' if node.tag == 'link' else 'value' if node.tag == 'param' else 'data' if node.tag == 'object' else 'src'
                src = node.attrs.get(attr)
                dest = normalize(src, url) if src else None
                if dest and Path(urllib.parse.urlsplit(dest).path).suffix.lower() in ASSET_SUFFIX:
                    if node.tag != 'script' or topic and urllib.parse.urlsplit(dest).path.startswith(urllib.parse.urlsplit(url).path.rsplit('/', 1)[0] + '/'):
                        assets[dest] = {'url': dest, 'alt': node.attrs.get('alt', ''), 'kind': node.tag}
            for key, value in node.attrs.items():
                if key.startswith('on') or key in {'style', 'background'} or key == 'href' and value.lstrip().lower().startswith('javascript:'):
                    candidates = re.findall(r"(?:url\(\s*['\"]?([^'\")]+)|['\"]([^'\"]+\.(?:s?html?|jpg|jpeg|png|gif|xml|json|swf))['\"])", value, re.I)
                    if key == 'background':
                        candidates.append((value, ''))
                    for first, second in candidates:
                        dest = normalize(first or second, url)
                        if dest:
                            extension = Path(urllib.parse.urlsplit(dest).path).suffix.lower()
                            target = links if extension in PAGE_SUFFIX else assets
                            target[dest] = {'url': dest, 'label': clean_text(node.text()), 'kind': 'inline-reference'}
            if node.tag == 'script' and topic:
                raw = ''.join(child for child in node.children if isinstance(child, str))
                for literal in re.findall(r"['\"]([^'\"\n]+\.(?:s?html?|js|xml|json|swf|jpg|png|gif))['\"]", raw, re.I):
                    dest = normalize(literal, url)
                    if dest:
                        target = links if Path(urllib.parse.urlsplit(dest).path).suffix.lower() in PAGE_SUFFIX else assets
                        target[dest] = {'url': dest, 'label': '', 'kind': 'script-reference'}
    return list(links.values()), list(assets.values())


def safe_html(node, url, assets, page_ids):
    if isinstance(node, str):
        return escape(node)
    if node.tag in SKIP_TAGS:
        return ''
    children = ''.join(safe_html(child, url, assets, page_ids) for child in node.children)
    if node.tag in {'iframe', 'frame', 'embed', 'object'}:
        src = normalize(node.attrs.get('src', node.attrs.get('data', '')), url)
        return '<p class="source-reference">嵌入资源：' + (f'<a href="{escape(src, quote=True)}" rel="noreferrer">{escape(src)}</a>' if src and allowed_host(src) else '已记录于资源索引') + '</p>' + children
    if node.tag not in ALLOWED_TAGS:
        return children
    attrs = []
    if node.tag == 'a':
        dest = normalize(node.attrs.get('href', ''), url) if node.attrs.get('href') else None
        if dest and dest in page_ids:
            attrs.append(('href', '#page=' + page_ids[dest]))
        elif dest and allowed_host(dest):
            attrs.extend([('href', dest), ('rel', 'noreferrer'), ('target', '_blank')])
        else:
            return children
    elif node.tag == 'img':
        dest = normalize(node.attrs.get('src', ''), url) if node.attrs.get('src') else None
        asset = assets.get(dest, {})
        if asset.get('status') != 'ok':
            return f'<span class="missing-image">[图片未获取：{escape(dest or node.attrs.get("alt", "未知"))}]</span>'
        attrs.extend([('src', asset['path']), ('alt', node.attrs.get('alt', '') or '官方原始图片，未自动识读'), ('loading', 'lazy')])
    elif node.tag in {'td', 'th'}:
        for key in ['colspan', 'rowspan']:
            value = node.attrs.get(key, '')
            if value.isdigit() and 0 < int(value) <= 100:
                attrs.append((key, value))
    elif node.tag in {'ol', 'li'}:
        for key in ['start', 'value']:
            if re.fullmatch(r'-?\d+', node.attrs.get(key, '')):
                attrs.append((key, node.attrs[key]))
    attr_text = ''.join(f' {key}="{escape(value, quote=True)}"' for key, value in attrs)
    return f'<{node.tag}{attr_text}>' + ('' if node.tag in VOID else children + f'</{node.tag}>')


def request(url, limit):
    global LAST_REQUEST
    for attempt in range(2):
        with LOCK:
            pause = max(0, LAST_REQUEST + 0.18 - time.monotonic())
            if pause:
                time.sleep(pause)
            LAST_REQUEST = time.monotonic()
        req = urllib.request.Request(url, headers={'User-Agent': 'PWI-Local-Reference-Archive/1.0 (public documentation; no authentication)', 'Accept': '*/*'})
        try:
            with urllib.request.urlopen(req, timeout=18) as response:
                final = normalize(response.url)
                if not final or not allowed_host(final):
                    return {'status': 'failed', 'error': '重定向到非官方域名', 'finalUrl': response.url}, None
                data = response.read(limit + 1)
                if len(data) > limit:
                    return {'status': 'failed', 'error': f'超过单资源大小限制 {limit}', 'finalUrl': response.url}, None
                return {'status': 'ok', 'httpStatus': response.status, 'contentType': response.headers.get('Content-Type', ''), 'finalUrl': response.url, 'fetchedAt': stamp(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}, data
        except urllib.error.HTTPError as error:
            if error.code == 429:
                return {'status': 'failed', 'httpStatus': 429, 'error': '服务器限流，停止重试'}, None
            if error.code < 500:
                return {'status': 'failed', 'httpStatus': error.code, 'error': str(error)}, None
            failure = {'status': 'failed', 'httpStatus': error.code, 'error': str(error)}
        except Exception as error:
            failure = {'status': 'failed', 'error': type(error).__name__ + ': ' + str(error)}
    return failure, None


def decode(data):
    for encoding in ['utf-8-sig', 'gb18030', 'big5']:
        try:
            return data.decode(encoding), encoding, 0
        except UnicodeDecodeError:
            pass
    text = data.decode('gb18030', errors='replace')
    return text, 'gb18030-replacement', text.count('\ufffd')


class JSLiteral:
    def __init__(self, text, position=0):
        self.text, self.position = text, position

    def skip(self):
        while self.position < len(self.text):
            if self.text[self.position].isspace():
                self.position += 1
            elif self.text.startswith('//', self.position):
                end = self.text.find('\n', self.position)
                self.position = len(self.text) if end < 0 else end + 1
            elif self.text.startswith('/*', self.position):
                end = self.text.find('*/', self.position + 2)
                if end < 0:
                    raise ValueError('未闭合注释')
                self.position = end + 2
            else:
                return

    def value(self):
        self.skip()
        character = self.text[self.position]
        if character in {'\"', "'"}:
            quote = character
            self.position += 1
            result = ''
            while self.position < len(self.text):
                character = self.text[self.position]
                self.position += 1
                if character == quote:
                    return result
                if character == '\\':
                    character = self.text[self.position]
                    self.position += 1
                    if character in {'u', 'x'}:
                        size = 4 if character == 'u' else 2
                        result += chr(int(self.text[self.position:self.position + size], 16))
                        self.position += size
                    elif character == '\n':
                        continue
                    elif character == '\r':
                        if self.text[self.position:self.position + 1] == '\n':
                            self.position += 1
                    else:
                        result += {'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f', 'v': '\v', '0': '\0'}.get(character, character)
                else:
                    result += character
            raise ValueError('未闭合字符串')
        if character in {'[', '{'}:
            mapping = character == '{'
            closing = '}' if mapping else ']'
            self.position += 1
            result = {} if mapping else []
            while True:
                self.skip()
                if self.text[self.position] == closing:
                    self.position += 1
                    return result
                if not mapping and self.text[self.position] == ',':
                    result.append({'$arrayHole': True})
                    self.position += 1
                    continue
                if mapping:
                    if self.text[self.position] in {'\"', "'"}:
                        key = self.value()
                    else:
                        match = re.match(r'[A-Za-z_$][\w$]*', self.text[self.position:])
                        if not match:
                            raise ValueError('非字面量对象键')
                        key = match.group()
                        self.position += len(key)
                    self.skip()
                    if self.text[self.position] != ':':
                        raise ValueError('对象键缺少冒号')
                    self.position += 1
                    result[key] = self.value()
                else:
                    result.append(self.value())
                self.skip()
                if self.text[self.position] == ',':
                    self.position += 1
                elif self.text[self.position] != closing:
                    raise ValueError('包含非字面量表达式，未执行')
        match = re.match(r'-?(?:\d+\.\d*|\d+|\.\d+)(?:[eE][+-]?\d+)?', self.text[self.position:])
        if match:
            literal = match.group()
            self.position += len(literal)
            return float(literal) if any(mark in literal for mark in '.eE') else int(literal)
        for literal, value in [('true', True), ('false', False), ('null', None)]:
            if self.text.startswith(literal, self.position):
                self.position += len(literal)
                return value
        raise ValueError('包含非字面量表达式，未执行')


def derived_page(asset, title, category, section, body, tables):
    page_id = identity(asset['url'] + '#structured')
    return {'id': page_id, 'url': asset['url'], 'title': title, 'category': category, 'section': section, 'depth': 0, 'parents': asset.get('parents', []), 'status': 'ok', 'fetchedAt': asset.get('fetchedAt'), 'publishedAt': None, 'bodyMode': 'data-derived', 'encoding': asset.get('textEncoding'), 'rawPath': asset['path'], 'dataPath': 'pages/' + page_id + '.json', 'text': clean_text(body), 'tables': tables, 'tableCount': len(tables), 'imageRefs': [], 'imageCount': 0, 'readableHtml': ''}


def structured_sources(output, pages, assets, gaps):
    counts = {'equipmentCompareRecords': 0, 'skillRecords': 0, 'skillClasses': 0}
    xml_asset = assets.get(normalize('https://w2i.wanmei.com/hd/wi_itemsdemo/items.xml'))
    if xml_asset and xml_asset['status'] == 'ok':
        text, _, _ = decode((output / xml_asset['path']).read_bytes())
        try:
            root = ET.fromstring(text)
            types = {clean_text(option.findtext('value', '')): clean_text(option.findtext('type', '')) for option in root.findall('./wiitemstype/option')}
            records = []
            for item in root.findall('.//wiitems//item'):
                raw = {child.tag: clean_text(child.text or '') for child in item}
                records.append({'sourceFields': raw, 'id': raw.get('id'), 'name': raw.get('itemsname'), 'type': types.get(raw.get('typeid'), raw.get('typeid')), 'sourceLevel': raw.get('level'), 'refineStatLabel': raw.get('name'), 'refineUnit': None if raw.get('uint') == '9999' else raw.get('uint'), 'materialsText': raw.get('info'), 'imageFilename': raw.get('imgname')})
            coefficients = [{child.tag: clean_text(child.text or '') for child in option} for option in root.findall('./wiitemsuplevel/option')]
            dataset = {'source': xml_asset['url'], 'fetchedAt': xml_asset.get('fetchedAt'), 'note': 'level字段在对比器中用于装备品阶筛选；uint是精炼加值单位，不是装备基础攻击/防御。uint=9999时原脚本隐藏精炼；材料空白保持未知。图片指向已失效旧域，未猜替代路径。', 'types': types, 'refineCoefficients': coefficients, 'records': records}
            (output / 'structured' / 'equipment-compare.json').write_text(json.dumps(dataset, ensure_ascii=False, indent=2))
            columns = ['原始ID', '名称', '类型', '原level字段', '精炼属性', '精炼单位', '制造材料原文', '原图片文件名']
            rows = [[{'text': cell, 'rowspan': '1', 'colspan': '1'} for cell in columns]]
            for record in sorted(records, key=lambda item: (int(item['sourceFields']['typeid']), int(item['sourceLevel']), int(item['id']))):
                rows.append([{'text': str(cell or ''), 'rowspan': '1', 'colspan': '1'} for cell in [record['id'], record['name'], record['type'], record['sourceLevel'], record['refineStatLabel'], record['refineUnit'], record['materialsText'], record['imageFilename']]])
            body = dataset['note'] + '\n' + '\n'.join(' | '.join(cell['text'] for cell in row) for row in rows)
            page = derived_page(xml_asset, '装备对比器：具名装备、品阶、精炼与材料', '装备道具', '装备对比数据库', body, [{'rows': rows}])
            page['readableHtml'] = '<p>' + escape(dataset['note']) + '</p><p>这里的精炼数值不是基础装备属性。</p><div class="table-scroll"><table>' + ''.join('<tr>' + ''.join('<td>' + escape(cell['text']).replace('\n', '<br>') + '</td>' for cell in row) + '</tr>' for row in rows) + '</table></div>'
            pages[xml_asset['url'] + '#structured'] = page
            counts['equipmentCompareRecords'] = len(records)
            gaps.append({'kind': 'lost-image-base', 'url': 'http://www.w2i.com.cn/html/upload/images/wiitems/', 'error': f'{len(records)}件装备的原图片目录已失效；XML保存文件名，不猜替代地址，基础属性不能由精炼单位推导'})
        except ET.ParseError as error:
            gaps.append({'kind': 'xml-parse', 'url': xml_asset['url'], 'error': str(error)})
    jobs = {'wuxia': '武侠', 'fashi': '法师', 'yumang': '羽芒', 'yuling': '羽灵', 'yaoshou': '妖兽', 'yaojing': '妖精', 'cike': '刺客', 'wushi': '巫师', 'jianling': '剑灵', 'meiling': '魅灵'}
    for asset in assets.values():
        stem = Path(urllib.parse.urlsplit(asset['url']).path).stem
        if stem not in jobs or '/201102/imitator/js/' not in asset['url'] or asset['status'] != 'ok':
            continue
        text, encoding, _ = decode((output / asset['path']).read_bytes())
        arrays, skills = {}, []
        for match in re.finditer(r'(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?=[\[{])', text):
            try:
                value = JSLiteral(text, match.end()).value()
                arrays[match.group(1)] = value
                if isinstance(value, list):
                    skills.extend(item for item in value if isinstance(item, dict) and 'id' in item and 'name' in item)
            except (ValueError, IndexError) as error:
                gaps.append({'kind': 'js-literal', 'url': asset['url'], 'error': match.group(1) + '：' + str(error)})
        if not skills:
            gaps.append({'kind': 'skills-unparsed', 'url': asset['url'], 'error': '已保存脚本，但未解析出字面量技能数组'})
            continue
        grouped = {}
        for skill in skills:
            grouped.setdefault(str(skill['id']), []).append(skill)
        for source_id, variants in grouped.items():
            if len(variants) > 1:
                gaps.append({'kind': 'duplicate-source-id', 'url': asset['url'], 'error': '原始技能ID ' + source_id + '对应多个记录，全部保留，不按ID丢弃仙魔变体：' + '、'.join(clean_text(Tree(str(skill['name'])).root.text()) for skill in variants)})
        dataset = {'source': asset['url'], 'encoding': encoding, 'fetchedAt': asset.get('fetchedAt'), 'class': jobs[stem], 'note': '安全解析JavaScript字面量，不执行上游脚本或技能公式。技能字段、逐级数组与公式字符串保持原文；稀疏数组空项以{"$arrayHole":true}标记，不冒充数值或null。2011路径是历史版本线索，不代替页面未标明的发布日期。', 'arrays': arrays, 'skills': skills}
        (output / 'structured' / ('skills-' + stem + '.json')).write_text(json.dumps(dataset, ensure_ascii=False, indent=2))
        fragments, body, tables = [], [dataset['note']], []
        icons = [icon for icon in assets.values() if icon.get('kind') == 'skill-icon' and icon.get('from') == asset['url']]
        icons_by_name = {Path(urllib.parse.urlsplit(icon['url']).path).name: icon for icon in icons}
        for skill in skills:
            fragments.append('<h2>' + escape(clean_text(Tree(str(skill['name'])).root.text())) + '</h2>')
            icon = icons_by_name.get(skill.get('img'))
            if icon and icon['status'] == 'ok':
                fragments.append('<img src="' + icon['path'] + '" alt="' + escape(str(skill['name']), quote=True) + '">')
            fragments.append('<dl>')
            body.append(str(skill['name']))
            for key, value in skill.items():
                rendered = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value)
                fragments.append('<dt>' + escape(key) + '</dt><dd>' + escape(rendered) + '</dd>')
                body.append(key + '：' + rendered)
            fragments.append('</dl>')
            arrays_by_level = {key: value for key, value in skill.items() if key in {'dengji', 'yuanshen', 'jinqian'} and isinstance(value, list)}
            if arrays_by_level:
                length = max(map(len, arrays_by_level.values()))
                rows = [[{'text': key, 'rowspan': '1', 'colspan': '1'} for key in ['技能等级', *arrays_by_level]]]
                for index in range(length):
                    rows.append([{'text': str(value), 'rowspan': '1', 'colspan': '1'} for value in [index + 1, *(values[index] if index < len(values) else '' for values in arrays_by_level.values())]])
                tables.append({'rows': rows})
        page = derived_page(asset, jobs[stem] + '：技能逐级数据与原始公式', '职业技能', '技能模拟器数据', '\n'.join(body), tables)
        page['readableHtml'] = '<p>' + escape(dataset['note']) + '</p>' + ''.join(fragments)
        page['imageRefs'] = [{'url': icon['url'], 'alt': icon.get('alt', ''), 'kind': 'skill-icon'} for icon in icons]
        page['imageCount'] = len(icons)
        pages[asset['url'] + '#structured'] = page
        counts['skillRecords'] += len(skills)
        counts['skillClasses'] += 1
    for page in pages.values():
        if page.get('bodyMode') == 'data-derived':
            (output / page['dataPath']).write_text(json.dumps(page, ensure_ascii=False, indent=2))
    return counts


def parse_page(record, data):
    text, encoding, replacements = decode(data)
    tree = Tree(text)
    title = clean_text(next(tree.root.walk('title'), Node()).text())
    for node in tree.root.walk('h2'):
        if node.parent and 'info_font' in node.parent.classes():
            title = clean_text(node.text())
            break
    published = re.search(r'发布时间[：:]?\s*(\d{4}[-/]\d{2}[-/]\d{2})', clean_text(tree.root.text()))
    scopes = body_scope(tree)
    body = clean_text('\n'.join(scope.text() for scope in scopes))
    topic = not re.search(r'/\d{8}/\d+\.shtml$', urllib.parse.urlsplit(record['url']).path)
    reference_scopes = [*scopes, *tree.root.walk('head')] if topic else scopes
    links, assets = references(reference_scopes, record['url'], topic)
    record.update({'title': title or record['title'], 'encoding': encoding, 'replacementCharacters': replacements, 'publishedAt': published.group(1) if published else None, 'text': body, 'tables': collect_tables(scopes), 'links': links, 'imageRefs': assets, 'bodyMode': 'article' if any('rep_text' in scope.classes() for scope in scopes) else 'topic', 'readableHtml': ''})
    return scopes


def directory_entries(data):
    text, _, _ = decode(data)
    tree = Tree(text)
    entries = []
    for group in tree.root.walk('div'):
        if 'info_list' not in group.classes():
            continue
        header = next(group.walk('h2'), Node())
        image = next(header.walk('img'), Node())
        category = image.attrs.get('alt', '') or clean_text(header.text()) or '未分类'
        for row in group.walk('tr'):
            cells = [node for node in row.children if isinstance(node, Node) and node.tag == 'td']
            if len(cells) < 2:
                continue
            section = clean_text(cells[0].text()).rstrip('：:')
            for link in cells[1].walk('a'):
                url = normalize(link.attrs.get('href', ''))
                if url:
                    entries.append({'category': category, 'section': section, 'title': clean_text(link.text()) or section, 'url': url, 'origin': 'directory'})
    for category, section, title, url in EXTRA_SEEDS:
        entries.append({'category': category, 'section': section, 'title': title, 'url': normalize(url), 'origin': 'user'})
    return entries


def archive(args):
    output = Path(args.output).resolve()
    for folder in ['raw', 'pages', 'assets', 'chapters', 'structured', 'downloads']:
        (output / folder).mkdir(parents=True, exist_ok=True)
    root_meta, root_data = request(DIRECTORY, 5_000_000)
    if root_meta['status'] != 'ok':
        raise RuntimeError('官方目录读取失败：' + root_meta['error'])
    (output / 'raw' / 'directory.html').write_bytes(root_data)
    roots = directory_entries(root_data)
    supplement = output / 'supplement-seeds.json'
    if supplement.exists():
        for entry in json.loads(supplement.read_text()):
            entry['url'] = normalize(entry['url'])
            entry['origin'] = 'verified-supplement'
            roots.append(entry)
    print(f'DIRECTORY entries={len(roots)} categories={len(set(root["category"] for root in roots))}', flush=True)
    pages, asset_map, excluded, gaps, scopes_by_id = {}, {}, {}, [], {}
    previous_index = output / 'index.json'
    previous_assets = {asset['url']: asset for asset in json.loads(previous_index.read_text()).get('assets', [])} if previous_index.exists() else {}
    notes_path = output / 'manual-gaps.json'
    if notes_path.exists():
        gaps.extend(json.loads(notes_path.read_text()))
    frontier = []
    for root in roots:
        extension = Path(urllib.parse.urlsplit(root['url']).path).suffix.lower()
        if extension in ASSET_SUFFIX and allowed_host(root['url']):
            root.update({'status': 'asset-queued', 'id': identity(root['url'])})
            asset_map.setdefault(root['url'], {'url': root['url'], 'id': root['id'], 'status': 'queued', 'parents': [], 'kind': 'verified-data-resource', 'category': root['category'], 'section': root['section']})
            continue
        reason = page_reason(root['url'])
        if reason:
            root.update({'status': 'excluded', 'reason': reason})
            excluded[root['url']] = {'url': root['url'], 'reason': reason, 'from': 'directory'}
            continue
        root['id'] = identity(root['url'])
        if root['url'] not in pages:
            record = {'id': root['id'], 'url': root['url'], 'title': root['title'], 'category': root['category'], 'section': root['section'], 'depth': 0, 'parents': [], 'status': 'queued'}
            pages[root['url']] = record
            frontier.append(record)
    processed = 0
    rate_limited = False

    def fetch_page(record):
        cache = output / 'pages' / (record['id'] + '.json')
        raw_path = output / 'raw' / (record['id'] + '.html')
        if cache.exists() and not args.refresh:
            previous = json.loads(cache.read_text())
            if previous.get('status') == 'failed':
                return record, {key: previous[key] for key in ['status', 'httpStatus', 'error', 'finalUrl', 'fetchedAt'] if key in previous}, None
            if previous.get('status') == 'ok' and raw_path.exists():
                return record, {key: previous[key] for key in ['status', 'httpStatus', 'contentType', 'finalUrl', 'fetchedAt', 'sha256', 'bytes', 'cached', 'provenance'] if key in previous}, raw_path.read_bytes()
        if raw_path.exists() and not args.refresh:
            data = raw_path.read_bytes()
            return record, {'status': 'ok', 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'fetchedAt': None, 'cached': True, 'provenance': 'recovered-raw-without-fetch-metadata'}, data
        meta, data = request(record['url'], 5_000_000)
        return record, meta, data

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        while frontier and processed < args.max_pages and not rate_limited:
            batch, frontier = frontier[:args.workers], frontier[args.workers:]
            for record, meta, data in pool.map(fetch_page, batch):
                processed += 1
                record.update(meta)
                if not data:
                    (output / 'pages' / (record['id'] + '.json')).write_text(json.dumps(record, ensure_ascii=False, indent=2))
                    gaps.append({'kind': 'page', 'url': record['url'], 'error': record.get('error', 'empty response')})
                    rate_limited |= record.get('httpStatus') == 429
                    continue
                record['rawPath'] = 'raw/' + record['id'] + '.html'
                (output / record['rawPath']).write_bytes(data)
                scopes_by_id[record['id']] = parse_page(record, data)
                (output / 'pages' / (record['id'] + '.json')).write_text(json.dumps(record, ensure_ascii=False, indent=2))
                if record['replacementCharacters']:
                    gaps.append({'kind': 'encoding', 'url': record['url'], 'error': '解码存在替代字符，需人工检查'})
                if not record['text'] and not record['imageRefs']:
                    gaps.append({'kind': 'empty', 'url': record['url'], 'error': '无可提取正文或图片，可能为Flash/动态界面'})
                for asset in record['imageRefs']:
                    if not allowed_host(asset['url']):
                        excluded[asset['url']] = {'url': asset['url'], 'reason': '非官方资源，仅保留链接', 'from': record['url']}
                        continue
                    info = asset_map.setdefault(asset['url'], {**asset, 'id': identity(asset['url']), 'status': 'queued', 'parents': []})
                    if record['id'] not in info['parents']:
                        info['parents'].append(record['id'])
                for link in record['links']:
                    dest = link['url']
                    suffix = Path(urllib.parse.urlsplit(dest).path).suffix.lower()
                    if suffix in ASSET_SUFFIX:
                        if allowed_host(dest):
                            asset_map.setdefault(dest, {**link, 'id': identity(dest), 'status': 'queued', 'parents': [record['id']]})
                        continue
                    reason = page_reason(dest)
                    if reason:
                        excluded.setdefault(dest, {'url': dest, 'reason': reason, 'from': record['url']})
                        continue
                    if dest in pages:
                        if record['id'] not in pages[dest]['parents']:
                            pages[dest]['parents'].append(record['id'])
                        continue
                    if record['depth'] >= args.max_depth:
                        gaps.append({'kind': 'depth-limit', 'url': dest, 'from': record['url'], 'error': '递归深度限制，未采集'})
                        continue
                    child = {'id': identity(dest), 'url': dest, 'title': link['label'] or dest.rsplit('/', 1)[-1], 'category': record['category'], 'section': record['section'], 'depth': record['depth'] + 1, 'parents': [record['id']], 'status': 'queued'}
                    pages[dest] = child
                    frontier.append(child)
            if processed % 24 < args.workers:
                print(f'PAGES processed={processed} discovered={len(pages)} pending={len(frontier)} assets={len(asset_map)}', flush=True)
        if frontier:
            for record in frontier:
                record['status'] = 'not-fetched'
                gaps.append({'kind': 'crawl-limit', 'url': record['url'], 'error': '页数限制或服务器限流，未采集'})
        assets = list(asset_map.values())

        def fetch_asset(asset):
            extension = Path(urllib.parse.urlsplit(asset['url']).path).suffix.lower() or '.bin'
            path = 'assets/' + asset['id'] + extension
            cached = output / path
            previous = previous_assets.get(asset['url'], {})
            cache_meta = output / 'assets' / (asset['id'] + '.meta.json')
            if cache_meta.exists():
                previous = json.loads(cache_meta.read_text())
            if previous.get('status') == 'failed' and not args.refresh:
                return asset, {key: previous[key] for key in ['status', 'httpStatus', 'error', 'finalUrl', 'fetchedAt'] if key in previous}, None, path
            if cached.exists() and not args.refresh:
                data = cached.read_bytes()
                previous = previous_assets.get(asset['url'], {})
                cache_meta = output / 'assets' / (asset['id'] + '.meta.json')
                if cache_meta.exists():
                    previous = json.loads(cache_meta.read_text())
                metadata = {'status': 'ok', 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'fetchedAt': previous.get('fetchedAt'), 'cached': True}
                for key in ['httpStatus', 'contentType', 'finalUrl']:
                    if key in previous:
                        metadata[key] = previous[key]
                return asset, metadata, data, path
            meta, data = request(asset['url'], 12_000_000)
            return asset, meta, data, path

        offset = 0
        while offset < min(len(assets), args.max_assets) and not rate_limited:
            batch = assets[offset:min(offset + args.workers, args.max_assets)]
            for asset, meta, data, path in pool.map(fetch_asset, batch):
                asset.update(meta)
                if data and Path(path).suffix.lower() in {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}:
                    try:
                        with Image.open(io.BytesIO(data)) as image:
                            image.verify()
                    except Exception:
                        asset.update({'status': 'failed', 'error': '返回的原始文件不能解码为图片；保留原始字节，不作为可用属性图'})
                        gaps.append({'kind': 'asset', 'url': asset['url'], 'error': asset['error']})
                if data:
                    asset['path'] = path
                    (output / path).write_bytes(data)
                    (output / 'assets' / (asset['id'] + '.meta.json')).write_text(json.dumps(asset, ensure_ascii=False, indent=2))
                    if Path(path).suffix == '.swf':
                        gaps.append({'kind': 'flash', 'url': asset['url'], 'error': '已归档Flash资源，未解析其内部数据'})
                    elif Path(path).suffix in {'.js', '.css', '.xml', '.json'}:
                        asset['textEncoding'] = decode(data)[1]
                        if Path(path).suffix == '.css':
                            css = decode(data)[0]
                            for quoted, bare in re.findall(r'url\(\s*(?:[\'\"]([^\'\"]+)[\'\"]|([^\s)]+))\s*\)', css, re.I):
                                dest = normalize(quoted or bare, asset.get('finalUrl') or asset['url'])
                                if not dest or Path(urllib.parse.urlsplit(dest).path).suffix.lower() not in ASSET_SUFFIX:
                                    continue
                                if not allowed_host(dest):
                                    excluded.setdefault(dest, {'url': dest, 'reason': '非官方样式资源，仅保留链接', 'from': asset['url']})
                                elif dest not in asset_map:
                                    child = {'url': dest, 'id': identity(dest), 'status': 'queued', 'parents': asset['parents'][:], 'kind': 'stylesheet-reference', 'from': asset['url']}
                                    asset_map[dest] = child
                                    assets.append(child)
                        elif Path(path).suffix == '.js' and '/201102/imitator/js/' in asset['url']:
                            source = decode(data)[0]
                            name_match = re.search(r"boxmain\.name\s*=\s*['\"]([^'\"]+)['\"]", source)
                            race_match = re.search(r'var\s+race\s*=\s*', source)
                            main = asset_map.get(normalize('https://event51.wanmei.com/w2i/201102/imitator/js/main.js'), {})
                            renderer = asset_map.get(normalize('https://event51.wanmei.com/w2i/201102/imitator/js/pub.js'), {})
                            parent = next((page for page in pages.values() if page['id'] in asset['parents']), None)
                            if name_match and race_match and main.get('path') and renderer.get('path') and parent:
                                main_source = decode((output / main['path']).read_bytes())[0]
                                render_source = decode((output / renderer['path']).read_bytes())[0]
                                prefix = re.search(r"imgurl\s*:\s*['\"]([^'\"]+)['\"]", main_source)
                                if prefix and "boxmain.imgurl+boxmain.name+'/'+n.img" in render_source:
                                    try:
                                        skill_items = JSLiteral(source, race_match.end()).value()
                                        for skill in skill_items:
                                            if not isinstance(skill, dict) or not skill.get('img'):
                                                continue
                                            dest = normalize(prefix.group(1) + name_match.group(1) + '/' + skill['img'], parent['url'])
                                            if dest and allowed_host(dest) and dest not in asset_map:
                                                child = {'url': dest, 'id': identity(dest), 'status': 'queued', 'parents': asset['parents'][:], 'kind': 'skill-icon', 'from': asset['url'], 'alt': skill.get('name', '')}
                                                asset_map[dest] = child
                                                assets.append(child)
                                    except (ValueError, IndexError):
                                        gaps.append({'kind': 'skill-images-unparsed', 'url': asset['url'], 'error': '技能图标的原字面量数据未完整解析，未猜测图片地址'})
                else:
                    (output / 'assets' / (asset['id'] + '.meta.json')).write_text(json.dumps(asset, ensure_ascii=False, indent=2))
                    gaps.append({'kind': 'asset', 'url': asset['url'], 'error': asset.get('error', '未获取')})
                    rate_limited |= asset.get('httpStatus') == 429
            offset += len(batch)
            if offset % 90 < args.workers:
                print(f'ASSETS processed={offset}/{len(assets)}', flush=True)
        for asset in assets:
            if asset['status'] == 'queued':
                asset['status'] = 'not-fetched'
                gaps.append({'kind': 'asset-limit', 'url': asset['url'], 'error': '资源数量限制或服务器限流，未采集'})
    page_ids = {url: record['id'] for url, record in pages.items() if record['status'] == 'ok'}
    for root in roots:
        if root.get('status') == 'excluded':
            continue
        root['status'] = asset_map[root['url']]['status'] if root.get('status') == 'asset-queued' else pages[root['url']]['status']
    for record in pages.values():
        record['dataPath'] = 'pages/' + record['id'] + '.json'
        if record['status'] == 'ok':
            record['readableHtml'] = ''.join(safe_html(scope, record['url'], asset_map, page_ids) for scope in scopes_by_id[record['id']])
            record['imageCount'] = sum(1 for item in record['imageRefs'] if Path(urllib.parse.urlsplit(item['url']).path).suffix.lower() in {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'})
            record['tableCount'] = len(record['tables'])
        (output / record['dataPath']).write_text(json.dumps(record, ensure_ascii=False, indent=2))
    derived_counts = structured_sources(output, pages, asset_map, gaps)
    for record in pages.values():
        if record['status'] == 'ok' and record.get('rawPath'):
            record['downloadPath'] = 'downloads/' + record['id'] + '.js'
            encoded = base64.b64encode((output / record['rawPath']).read_bytes()).decode('ascii')
            payload = 'window.OFFICIAL_SOURCE_DOWNLOADS=window.OFFICIAL_SOURCE_DOWNLOADS||{};window.OFFICIAL_SOURCE_DOWNLOADS[' + json.dumps(record['rawPath']) + ']=' + json.dumps(encoded) + ';\n'
            (output / record['downloadPath']).write_text(payload)
            (output / record['dataPath']).write_text(json.dumps(record, ensure_ascii=False, indent=2))
    undated_cache = sum(record['status'] == 'ok' and not record.get('fetchedAt') for record in [*pages.values(), *asset_map.values()] if record.get('bodyMode') != 'data-derived')
    if undated_cache:
        gaps.append({'kind': 'cache-metadata', 'url': DIRECTORY, 'error': f'{undated_cache}份已恢复原文件缺少最初请求元数据；保留SHA256，获取日期未知，不将本次整理日期冒充下载日期'})
    manifest = {'schemaVersion': 1, 'directoryUrl': DIRECTORY, 'harvestedAt': stamp(), 'scope': '官方资料库info_list目录与用户补充入口的公开静态正文、真实内容链接、专题iframe及图片；不含全站新闻历史、账号/支付/客服/社区或未解析动态/Flash数据', 'limits': {'maxPages': args.max_pages, 'maxAssets': args.max_assets, 'maxDepth': args.max_depth, 'workers': args.workers}, 'roots': roots, 'pages': list(pages.values()), 'assets': list(asset_map.values()), 'gaps': gaps, 'excluded': list(excluded.values())}
    manifest['counts'] = {'directoryEntries': sum(root['origin'] == 'directory' for root in roots), 'seedEntries': len(roots), 'pagesDiscovered': len(pages), 'pagesOk': sum(page['status'] == 'ok' for page in pages.values()), 'pagesFailed': sum(page['status'] != 'ok' for page in pages.values()), 'assetsDiscovered': len(assets), 'assetsOk': sum(asset['status'] == 'ok' for asset in assets), 'assetsFailed': sum(asset['status'] != 'ok' for asset in assets), 'tables': sum(page.get('tableCount', 0) for page in pages.values()), 'gaps': len(gaps), 'excluded': len(excluded)}
    manifest['counts'].update(derived_counts)
    manifest['counts']['sourcePagesOk'] = sum(page['status'] == 'ok' and page.get('bodyMode') != 'data-derived' for page in pages.values())
    manifest['counts']['derivedDocuments'] = sum(page.get('bodyMode') == 'data-derived' for page in pages.values())
    compact = {**manifest, 'pages': [{key: value for key, value in page.items() if key not in {'text', 'tables', 'readableHtml', 'imageRefs', 'links'}} for page in manifest['pages']]}
    (output / 'index.json').write_text(json.dumps(compact, ensure_ascii=False, indent=2))
    (output / 'data.js').write_text('window.OFFICIAL_LIBRARY=' + json.dumps(manifest, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029') + ';\n')
    write_book(output, manifest)
    print('DONE ' + json.dumps(manifest['counts'], ensure_ascii=False), flush=True)
    return manifest


def write_book(output, manifest):
    counts = manifest['counts']
    directory_roots = [root for root in manifest['roots'] if root['origin'] == 'directory']
    root_failures = sum(root['status'] not in {'ok', 'excluded'} for root in directory_roots)
    root_excluded = sum(root['status'] == 'excluded' for root in directory_roots)
    intro = ['# 完美国际官方资料册', '', f'整理时间：{manifest["harvestedAt"]}', '', f'来源目录：{DIRECTORY}', '', '这是官方历史资料的本地归档，不是2026现行完整数据库，也不代表H5已实现这些内容。名称、单位、数值与随机属性保留原文；图片保存原图但不自动转录数值；不同版本和缺失数据不推断补齐。', '', '## 阅读方式', '', '- [打开离线检索阅读器](index.html)：按分类、章节、标题或多个关键词查询；点击条目查看正文、表格和原图。', '- 保留整个 official-library 文件夹，不能只复制 index.html；离线阅读不需要登录或联网。', '- 原始页面和脚本只归档，不在阅读器执行；来源页面、发布时间、获取时间与文件校验值分别保存。', '', '## 本次覆盖', '', f'- 官方原目录：{counts["directoryEntries"]}个入口（含重复链接），其中{root_excluded}个账号、客户端等入口按边界排除，{root_failures}个入口未成功获取。', f'- 实际归档网页：{counts["sourcePagesOk"]}页；网页失败或未获取：{counts["pagesFailed"]}页。', f'- 静态资源：{counts["assetsOk"]}份成功归档，{counts["assetsFailed"]}份失败或未获取。', f'- 从原始数据资源整理的阅读文档：{counts["derivedDocuments"]}份，不计入实际网页数量。', f'- 装备对比XML：{counts["equipmentCompareRecords"]}条具名装备的品阶、精炼或材料记录，**不是同等数量的完整基础属性装备，也不是原版装备全集**。', f'- 职业技能：{counts["skillClasses"]}职业、{counts["skillRecords"]}条历史技能记录；逐级数组与公式保留原文，未执行公式。', f'- 缺项记录：{counts["gaps"]}条；每条附来源与原因，见[缺项清单](缺项与采集边界.md)。', '', '## 采集范围', '', manifest['scope'], '', '## 分类分册', '']
    categories = list(dict.fromkeys(root['category'] for root in manifest['roots']))
    intro.append('- [官方原目录逐项核对表](目录逐项核对.md)')
    status_labels = {'ok': '已归档', 'failed': '失败', 'not-fetched': '未采集', 'excluded': '边界排除'}
    by_url = {page['url']: page for page in manifest['pages']}
    review = ['# 官方原目录逐项核对', '', f'原目录共{len(directory_roots)}个入口，按原顺序保留，包括重复链接。已归档仅表示保存了原文，不代表属性图片已全部识读或动态专题已完整解析；年代不同的条目不合并为同一个确定版本。', '', '| 序号 | 分类 | 章节 | 原目录标题 | 状态 | 本地阅读 | 来源 | 原因 |', '| --- | --- | --- | --- | --- | --- | --- | --- |']
    for number, root in enumerate(directory_roots, 1):
        page = by_url.get(root['url'], {})
        local = f'[阅读](index.html#page={page["id"]})' if page else '—'
        reason = root.get('reason') or page.get('error') or ''
        cells = [str(number), root['category'], root['section'], root['title'], status_labels.get(root['status'], root['status']), local, f'[原站]({root["url"]})', reason]
        review.append('| ' + ' | '.join(cell.replace('|', '\\|').replace('\n', '<br>') for cell in cells) + ' |')
    (output / '目录逐项核对.md').write_text('\n'.join(review) + '\n')
    for index, category in enumerate(categories, 1):
        filename = f'{index:02d}-{category}.md'
        intro.append(f'- [{category}](chapters/{filename})')
        records = [page for page in manifest['pages'] if page['category'] == category]
        lines = [f'# {category}', '', '属性图片为官方原始资料，不代表已识读；网页表格中的固定/随机标记保留原文，不将随机池视为全部同时获得。', '']
        for page in records:
            lines.extend([f'## {page["title"]}', '', f'- 来源：{page["url"]}', f'- 原文发布时间：{page.get("publishedAt") or "页面未标明"}', f'- 获取状态：{page["status"]}', f'- 本地结构化数据：[JSON](../{page["dataPath"]})', ''])
            if page['status'] != 'ok':
                lines.extend([page.get('error', '未获取'), ''])
                continue
            lines.extend([page['text'], ''])
            if page['tables']:
                lines.extend(['### 原始表格（按行与单元格保存）', ''])
                for number, table in enumerate(page['tables'], 1):
                    lines.extend([f'#### 表 {number}', ''])
                    width = max(len(row) for row in table['rows'])
                    lines.extend(['| ' + ' | '.join(f'列 {column + 1}' for column in range(width)) + ' |', '| ' + ' | '.join('---' for _ in range(width)) + ' |'])
                    for row in table['rows']:
                        cells = [cell['text'].replace('|', '\\|').replace('\n', '<br>') + (f'（跨{cell["rowspan"]}行/{cell["colspan"]}列）' if cell['rowspan'] != '1' or cell['colspan'] != '1' else '') for cell in row]
                        lines.append('| ' + ' | '.join(cells + [''] * (width - len(cells))) + ' |')
                    lines.append('')
            image_refs = [item for item in page['imageRefs'] if Path(urllib.parse.urlsplit(item['url']).path).suffix.lower() in {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'}]
            if image_refs:
                lines.extend(['### 官方原始图片（尚未全部转录）', ''])
                assets = {asset['url']: asset for asset in manifest['assets']}
                for image in image_refs:
                    asset = assets.get(image['url'], {})
                    lines.append(f'- 原图来源：{image["url"]}')
                    if asset.get('status') == 'ok':
                        lines.append(f'![官方原始图片](../{asset["path"]})')
                    else:
                        lines.append('  图片未获取。')
                lines.append('')
        (output / 'chapters' / filename).write_text('\n'.join(lines))
    intro.extend(['', '## 边界与缺项', '', '- 原始HTML与资源只用于核查，阅读入口不会执行上游JavaScript、Flash、表单或注册支付代码。', '- 页面发布年代与采集时间分开记录；页面宣称“以线上游戏内数据为准”时不能当成最新游戏数据库。', '- 图片归档不等于数值转录完成；动态/Flash内容不能宣称已解析。', '- 未证实的概率、价格、完整制造配方、最新高品装备、绝对命中/五行防御的战斗换算仍属待核验信息。', '', '[全部缺项与排除记录](缺项与采集边界.md)', '[机器索引](index.json)', '[离线检索阅读入口](index.html)', ''])
    (output / '完美国际官方资料册.md').write_text('\n'.join(intro))
    gap_lines = ['# 缺项与采集边界', '', '## 获取失败、未解析与采集限制', '']
    for gap in manifest['gaps']:
        gap_lines.append(f'- **{gap["kind"]}** {gap["url"]} — {gap["error"]}')
    gap_lines.extend(['', '## 有意排除的边界', ''])
    for item in manifest['excluded']:
        gap_lines.append(f'- {item["url"]} — {item["reason"]}')
    (output / '缺项与采集边界.md').write_text('\n'.join(gap_lines) + '\n')


def verify_library(output):
    output = Path(output).resolve()
    manifest = json.loads((output / 'index.json').read_text())
    page_ids = {page['id'] for page in manifest['pages']}
    assert len(page_ids) == len(manifest['pages']), '重复页面ID'
    assert manifest['counts']['directoryEntries'] == 198, '官方原目录条目数发生变化，需重新核查'
    checked_hashes, table_rows = 0, 0
    for metadata in manifest['pages']:
        page = json.loads((output / metadata['dataPath']).read_text())
        assert page['id'] == metadata['id'] and page['status'] == metadata['status']
        if page['status'] != 'ok':
            continue
        raw = (output / page['rawPath']).read_bytes()
        download = (output / page['downloadPath']).read_text()
        prefix = 'window.OFFICIAL_SOURCE_DOWNLOADS=window.OFFICIAL_SOURCE_DOWNLOADS||{};window.OFFICIAL_SOURCE_DOWNLOADS[' + json.dumps(page['rawPath']) + ']='
        assert download.startswith(prefix) and download.endswith(';\n')
        assert base64.b64decode(json.loads(download[len(prefix):-2]), validate=True) == raw
        if page.get('bodyMode') != 'data-derived':
            assert hashlib.sha256(raw).hexdigest() == page['sha256'], page['url']
            checked_hashes += 1
        html = page['readableHtml']
        parsed = Tree(html)
        for node in parsed.root.walk():
            assert node.tag not in {'script', 'iframe', 'embed', 'object', 'form'}, page['url']
            assert not any(key.startswith('on') or key == 'style' for key in node.attrs), page['url']
            if node.tag == 'img':
                source = node.attrs['src']
                assert source.startswith('assets/') and (output / source).is_file(), source
            if node.tag == 'a' and node.attrs.get('href', '').startswith('#page='):
                assert node.attrs['href'][6:] in page_ids
        assert len(page['tables']) == page['tableCount']
        table_rows += sum(len(table['rows']) for table in page['tables'])
    for asset in manifest['assets']:
        if asset['status'] == 'ok':
            data = (output / asset['path']).read_bytes()
            assert hashlib.sha256(data).hexdigest() == asset['sha256'], asset['url']
            if Path(asset['path']).suffix.lower() in {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}:
                with Image.open(io.BytesIO(data)) as image:
                    image.verify()
            checked_hashes += 1
    for root in manifest['roots']:
        assert root['status'] in {'ok', 'failed', 'not-fetched', 'excluded'}, root
        if root['status'] not in {'ok', 'excluded'}:
            assert any(gap['url'] == root['url'] for gap in manifest['gaps']), root
    data = (output / 'data.js').read_text()
    assert data.startswith('window.OFFICIAL_LIBRARY=') and data.endswith(';\n')
    full = json.loads(data[len('window.OFFICIAL_LIBRARY='):-2])
    assert full['counts'] == manifest['counts']
    equipment = output / 'structured' / 'equipment-compare.json'
    if equipment.exists():
        dataset = json.loads(equipment.read_text())
        assert len(dataset['records']) == 744 and len({item['id'] for item in dataset['records']}) == 744
        assert dataset['refineCoefficients'][0]['value'] == '1.00'
        assert dataset['refineCoefficients'][-1]['value'] == '37.50'
        sample = next(item for item in dataset['records'] if item['name'] == '亡骨刀')
        assert sample['sourceLevel'] == '8' and sample['refineUnit'] == '14'
        assert sample['materialsText'] == '秦天的刀刃5\n亡骨之片10\n千机材1'
    skills = list((output / 'structured').glob('skills-*.json'))
    assert len(skills) == manifest['counts']['skillClasses'] == 10, '十职业技能解析未完成'
    assert manifest['counts']['skillRecords'] == sum(len(json.loads(path.read_text())['skills']) for path in skills)
    review = (output / '目录逐项核对.md').read_text()
    assert sum(line.startswith('| ') for line in review.splitlines()) == manifest['counts']['directoryEntries'] + 2
    for path in skills:
        dataset = json.loads(path.read_text())
        assert dataset['skills'] and all('id' in skill and 'name' in skill for skill in dataset['skills'])
        source_asset = next(asset for asset in manifest['assets'] if asset['url'] == dataset['source'])
        source, _, _ = decode((output / source_asset['path']).read_bytes())
        for skill in dataset['skills']:
            assert skill['name'] in source, skill['name']
    print(json.dumps({'validation': 'passed', 'hashedFiles': checked_hashes, 'tableRows': table_rows, 'skillDataFiles': len(skills), 'counts': manifest['counts']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=str(ROOT / 'official-library'))
    parser.add_argument('--workers', type=int, choices=[1, 2, 3, 4], default=3)
    parser.add_argument('--max-pages', type=int, default=1600)
    parser.add_argument('--max-assets', type=int, default=6000)
    parser.add_argument('--max-depth', type=int, default=12)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    if args.verify_only:
        verify_library(args.output)
    else:
        archive(args)
