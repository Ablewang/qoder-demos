var imageurl = 'http://www.w2i.com.cn/html/upload/images/wiitems/';

function  getIndexByValue(obj,value){
	var len=obj.options.length;
	
	for(var i=0;i<len;i++){
		var a=obj.options[i].value;
		var b=value;
     	if(a==b){ 
     		
			return i;
		}
	}
	return 0;
}
function focusByValue(obj,value){
	
	var i=getIndexByValue(obj,value);    
     obj.options[i].selected = true;
}

var http_request = false;
var xmldoc = false;


var select1 = null;

function init(URL){
	if (window.XMLHttpRequest) { // Mozilla, Safari, ...
	    http_request = new XMLHttpRequest();
	} else if (window.ActiveXObject) { // IE
	    http_request = new ActiveXObject("Microsoft.XMLHTTP");
	}
	http_request.onreadystatechange = alertContents;
	http_request.open('GET',URL,true);
	http_request.send(null);
}

function trimElement(nodes){
    var result = [];
    for(var i=0,len = nodes.length; i < len; i++){
        if(nodes[i].nodeType==1) result.push(nodes[i]);
    }
    return result;
}

function xml_html(el){
	var temstr = '';
	xmldoc = http_request.responseXML;
	var options = xmldoc.getElementsByTagName(el)[0].childNodes;
	var z = options.length;
	for(i=0; i<z; i++){
		if(options[i].nodeType == 1){
		var pp = trimElement(options[i].childNodes);
		temstr += "<option value='"+ (pp[0].textContent || pp[0].text)+"'>";
		temstr += pp[1].textContent || pp[1].text ;
		temstr +="</option>";
		}	
	}	
	return temstr;
}

function alertContents(){
	if(http_request.readyState == 4){
		if(http_request.status == 200){
			var select1 = document.getElementById("select1");
			var select2 = document.getElementById("select2");
			var select3 = document.getElementById("select4");
			select1.innerHTML = '<select id=typeid name=typeid onchange="inititems()">'+xml_html('wiitemstype')+'</select>';
			select2.innerHTML = '<select id=level name=level onchange="inititems()">'+xml_html('wiitemslevel')+'</select>';
			select3.innerHTML = '<select id=uplevel name=upleve onchange="chinfo()">'+xml_html('wiitemsuplevel')+'</select>';
			inititems(); 
		}else{
			alert('nothing');
		}
	}
}

function inititems(){
	var typeid = document.getElementById('typeid');
	var level  = document.getElementById('level');
	var value1 = valueadd0(typeid.options[typeid.selectedIndex].value,3);
	var value2 = valueadd0(level.options[level.selectedIndex].value,3);
	
	var select3 = document.getElementById("select3");
	//alert('item'+value1+value2+'');
	try{
		var options = xmldoc.getElementsByTagName('item'+value1+value2)[0].childNodes;
		var temstr = '';
		var z = options.length;
		for(i=0; i<z; i++){
			if(options[i].nodeType == 1){
			var pp = trimElement(options[i].childNodes);
			temstr += "<option value='"+ (pp[0].textContent || pp[0].text)+"'>";
			temstr += pp[3].textContent || pp[3].text ;
			temstr +="</option>";
			}	
		}
		select3.innerHTML = '<select id=itemsid name=itemsid onchange="chinfo()" >'+temstr+'</select>';
			
		
	}catch(erro){
		select3.innerHTML = '<select id=itemsid name=itemsid ><option value=0>没有该等级的装备</option</select>';
	}
	chinfo();	
	
}

function getitems(){
	
	
	
	var typeid = document.getElementById('typeid');
	var level  = document.getElementById('level');
	var itemsid = document.getElementById('itemsid');
	
	var value1 = valueadd0(typeid.options[typeid.selectedIndex].value,3);
	var value2 = valueadd0(level.options[level.selectedIndex].value,3);
	var value3 = itemsid.options[itemsid.selectedIndex].value;
	
	var options = trimElement(xmldoc.getElementsByTagName('item'+value1+value2)[0].childNodes);
		var id = '';
		var t = options.length;
		for(u=0; u<t; u++){
			id = options[u].childNodes[0].text || options[u].childNodes[0].textContent;
			if(parseInt(id) == parseInt(value3)){ return options[u]; }				
		}
	return false;
	/*try{

	}catch(erro){
		return null;
	}*/
}

function chinfo(){
	var info = document.getElementById('info');
	var upvalue = document.getElementById('upvalue');
	var uplevel = document.getElementById('uplevel');
	var upmodify = uplevel.options[uplevel.selectedIndex].value;
	
	var img01 = document.getElementById('img01');
	
	
	
	var items = getitems();
	if(items!=null){
		var ppp = trimElement(items.childNodes);
		var uint = ppp[6].text || ppp[6].textContent;
		if(uint!=9999){
			info.innerHTML = (ppp[5].text || ppp[5].textContent)+' 增加 ';		
			upvalue.innerHTML = ''+(upmodify * 1.0 *uint).toFixed(0);
			img01.src = imageurl+(ppp[4].text || ppp[4].textContent);
			//img01.src = 'http://127.0.0.1/upload/wiitems/'+items.childNodes[4].text;
			//图片地址
		}else{
			info.innerHTML = '';
			upvalue.innerHTML = '';
			img01.src = imageurl+(ppp[4].text || ppp[4].textContent);
		}
		
		
	}else{
		info.innerHTML = '请选择一个装备 ';
		upvalue.innerHTML = '';
		img01.src = 'images/noimg.jpg';
		
	}
	
	try{
		var text01 = document.getElementById('text01');
		if(items!=null){
			var sss = items.childNodes[7].text || items.childNodes[7].textContent;
			var regS = new RegExp("\n","g");
			sss = sss.replace(regS,"<br>");
			text01.innerHTML = ''+sss;
			//text01.innerHTML = ''+items.childNodes[7].text;
		}else{
			text01.innerHTML = '精炼说明';
		}
	}catch(erro){
		
	}
}

function valueadd0(va,we){
	var k = we - va.length;
	var s = va + ''
	for(i=0;i<k;i++){
		s = '0' + s
	}
	return s;
}