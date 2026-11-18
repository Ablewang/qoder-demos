(function($) {
	$.fn.dscroll = function(options) {
		var opt = $.extend($.fn.dscroll.defaults,options);
		opt.$this = $(this);
		opt.amount = opt.$this.children().size();
		opt.unitHeight = opt.$this.children().height();
		opt.maxHeight = opt.unitHeight * opt.amount;

		opt.$this.css({
			height: opt.boxHeight,
			overflow: 'hidden'
		});
		slide(opt);

		opt.$this.mouseover(function() {
	        opt.$this.children().stop();
	    });
	    opt.$this.mouseleave(function() {
	        slide(opt);
	    });
	}

	$.fn.dscroll.defaults = {
		interval: 0,                     //滚动暂停时间，默认为0，单位毫秒
		speed: 0.025,                	 //滚动速度，数值越高，速度越快，建议取值0.025-0.05
		boxHeight: 300                   //显示高度
	}

	function slide(opt) {

		if(opt.maxHeight > opt.boxHeight) {
            
            duration = (opt.unitHeight + parseInt(opt.$this.children(':first').css("marginTop"))) / opt.speed;
            opt.$this.children(':first').delay(opt.interval).animate({
                marginTop: -opt.unitHeight
            },duration,"linear",function() {
                opt.$this.children(':first').css("marginTop","0");
                opt.$this.children(':last').after(opt.$this.children(':first'));
            	slide(opt);
            });
        } 
	}

	//固定飘窗
	$.fn.fix = function(options) {
		var opt = $.extend($.fn.fix.defaults,options);
		opt.$this = $(this);
		fixed(opt);
		$(window).scroll(function() {
			fixed(opt);
		});
	}

	$.fn.fix.defaults = {
		awayTop: 230,
		slideTime: 500
	}

	function fixed(obj) {
		var offsetTop = $(document).scrollTop() + obj.awayTop;
		obj.$this.stop().animate({
			top: offsetTop
		},obj.slideTime);
	}

})(jQuery);