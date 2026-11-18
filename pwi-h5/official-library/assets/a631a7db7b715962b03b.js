// JavaScript Document
$(function(){
	var regname = $('#flart_regbar');
	function regscroll() {
		var offset = $(document).scrollTop() + 180;
		$(regname).animate({ top: offset }, { duration: 200, queue: false });
	};
	regscroll();
	$(window).scroll(regscroll);
	
	function flart_regbarS(){
		$('#flart_regbar').stop().animate({'width':'0px'},500,function(){
			$('#regbox').hide();
			$('#flart_regbar').css('width','44px');
			$('.btn_bar').show();
		});
	}
	$('.close_bar').click(function(){
		flart_regbarS();
	});
	//setTimeout(flart_regbarS,2000)
	$('.btn_bar').click(function(){
		$(this).hide();
		$('#flart_regbar').css('width','0px');
		$('#regbox').show();
		$('#flart_regbar').stop().animate({'width':'244px'},500);
	});
	

	$('.top_nav2,.h_btn02').click(function(){
		regname.show();
		$('.btn_bar').hide();
		$('#flart_regbar').css('width','0px');
		$('#regbox').show();
		$('#flart_regbar').stop().animate({'width':'244px'},500);
	});
	
	
	//返回顶部
	// 右侧固定导航
		
/*var isIE = !!window.ActiveXObject;
var isIE6 = isIE && !window.XMLHttpRequest; 
var $side = $('#float-nav');
var pos = isIE6 ? 'absolute' : 'fixed';
$(window).on('scroll',function(){
	$side.css('position',pos);
})
$(window).scroll();*/

$('.h_btn01').click(function(){
	var n = $(this).attr('tip');
	$("body,html").animate({scrollTop:n},300);
});


	
});