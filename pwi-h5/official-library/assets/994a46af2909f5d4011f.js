var pwiw_size = pwiw_size ? pwiw_size: {};
var pwiw_border = pwiw_border ? pwiw_border: [26, 2, 2, 2];
var pwiw_maxsize = pwiw_maxsize ? pwiw_maxsize: (window.screen.width < 1200 || window.screen.height < 800) ? [720, 540] : [800, 600];
var pwiw_timer = 0,
pwiw_perload = pwiw_perload === undefined ? false: pwiw_perload;
var pwiw_selector = pwiw_selector ? pwiw_selector: 'a',
pwiw_imgl = null;
function pwiw_checksize(size) {
    if (size && size.length == 2) {
        var result = [parseInt(size[0]), parseInt(size[1])];
        var size = [parseInt(size[0]), parseInt(size[1])];
        if (size[0] > pwiw_maxsize[0]) {
            result[0] = pwiw_maxsize[0];
            result[1] = parseInt(size[1] * pwiw_maxsize[0] / size[0]);
            result[4] = true
        }
        if (result[1] > pwiw_maxsize[1]) {
            result[1] = pwiw_maxsize[1];
            result[0] = parseInt(size[0] * pwiw_maxsize[1] / size[1]);
            result[4] = true
        }
        result[2] = result[0] + pwiw_border[1] + pwiw_border[3];
        result[3] = result[1] + pwiw_border[0] + pwiw_border[2];
        return result
    }
}
function pwiw_init() {
    pwiw_load('http://ued.dev.wanmei.com/news_images/images/loading.gif');
    $('body').append('<div id="pwiw_dialog"><p><img id="pwiw_img" /></p></div>');
    $('#pwiw_dialog').dialog({
        height: pwiw_checksize(pwiw_maxsize)[3],
        width: pwiw_checksize(pwiw_maxsize)[2],
        modal: true,
        autoOpen: false,
        closeOnEscape: true,
        position: 'center',
        show: 'slide',
        hide: 'slide',
        dialogClass: 'pwiw_dialog'
    }).click(function() {
        $('#pwiw_dialog').dialog('close')
    });
    $('.pwiw_dialog .ui-dialog-titlebar-close').clone().appendTo($('.pwiw_dialog > .ui-dialog-titlebar')).removeClass('ui-dialog-titlebar-close').addClass('ui-dialog-titlebar-zoom').attr({
        id: 'pwiw_zoombtn',
        target: '_blank'
    });
    $('#pwiw_img').css({
        width: pwiw_maxsize[0] + 'px',
        height: pwiw_maxsize[1] + 'px'
    }).load(function() {
        $(this).css({
            display: 'none',
            visibility: 'visible'
        }).fadeIn('slow')
    }).click(function() {
        $('#pwiw_dialog').dialog('close')
    });
    $(pwiw_selector).each(function(i, n) {
        var a = $(n);
        var imgr = /\.(jpg|png|bmp|gif)$/i;
        var href = a.attr('href');
        var img = $('img', a);
        if (imgr.test(href) && img.length) {
            if (pwiw_perload) {
                pwiw_load(href)
            }
            a.click(pwiw_show).hover(function() {
                $('div', this).addClass('hover')
            },
            function() {
                $('div', this).removeClass('hover')
            }).append($('<div class=""></div>').attr('title', '')).addClass('ui-dialog-border').attr('title', '')
        }
    });
    pwiw_imgl = new Image();
    pwiw_imgl.src = '/public/images/zoom_icon_hover.gif'
}
function pwiw_show() {
    var size = pwiw_size[this.href];
    if (size) {
        $('#pwiw_zoombtn').css('display', size[4] ? '': 'none').attr('href', this.href);
        $('#pwiw_img').css({
            visibility: 'hidden',
            width: size[0] + 'px',
            height: size[1] + 'px'
        }).attr('src', this.href);
        $('#pwiw_dialog').dialog('option', 'width', size[2]).dialog('option', 'height', size[3]).dialog('open')
    } else {
        $('#pwiw_zoombtn').css('display', 'none');
        $('#pwiw_img').css('visibility', 'hidden');
        $("#pwiw_dialog").dialog('option', 'width', pwiw_checksize(pwiw_maxsize)[2]).dialog('option', 'height', pwiw_checksize(pwiw_maxsize)[3]).dialog('open');
        pwiw_imgl.onload = function() {
            if ($('#pwiw_dialog').dialog('isOpen')) {
                var size = pwiw_size[this.src] = pwiw_checksize([this.width, this.height]);
                $('#pwiw_zoombtn').css('display', size[4] ? '': 'none').attr('href', this.src);
                var de = document.documentElement;
                var scrollLeft = parseInt(de.scrollLeft || window.pageXOffset);
                var scrollTop = parseInt(de.scrollTop || window.pageYOffset);
                scrollLeft = isNaN(scrollLeft) ? 0: scrollLeft;
                scrollTop = isNaN(scrollTop) ? 0: scrollTop;
                var left = (scrollLeft + (parseInt(de.clientWidth) - size[2]) / 2);
                var top = (scrollTop + (parseInt(de.clientHeight) - size[3]) / 2);
                left = (left < scrollLeft ? scrollLeft: left) + 'px';
                top = (top < scrollTop ? scrollTop: top) + 'px';
                $('.pwiw_dialog').animate({
                    left: left,
                    top: top,
                    width: size[2] + 'px',
                    height: size[3] + 'px'
                },
                'normal', null, 
                function() {
                    $('#pwiw_dialog').dialog('option', 'width', size[2]).dialog('option', 'height', size[3])
                });
                $('#pwiw_img').css({
                    width: size[0] + 'px',
                    height: size[1] + 'px'
                }).attr('src', this.src)
            }
        };
        pwiw_imgl.src = this.href
    }
    return false
}
function pwiw_load(href) {
    var imgl = new Image();
    imgl.src = href;
    imgl.onload = function() {
        pwiw_size[this.src] = pwiw_checksize([imgl.width, imgl.height])
    };
    imgl.onerror = function() {
        pwiw_size[this.src] = false
    }
}
$(function() {
    pwiw_init()
});