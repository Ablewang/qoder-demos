var allbgindex=0;
$(document).ready(function(){
	$('#btn1').mousedown(function(){
		$('#section_right').css({'background':'url(images/qing.jpg) no-repeat'});		
		//clearInterval(aa);
	})		
	$('#btn2').mousedown(function(){
		$('#section_left').css({'background':'url(images/black.jpg) no-repeat'});		
		//clearInterval(aa);
	})	
	/*$('#btn3').mousedown(function(){
		$('#section_left').css({'background':'url(images/white.jpg) no-repeat'});		
		clearInterval(aa);
	})
	$('#btn4,#btn7').mousedown(function(){
		$('#section_right').css({'background':'url(images/chi.jpg) no-repeat'});	
		clearInterval(aa);
	})
	$('#btn6').mousedown(function(){
		$('#section_right').css({'background':'url(images/four_war.jpg) no-repeat'});		
		clearInterval(aa);
	})*/
})

/*function showTime(){
		allbgindex++;
		$('#section_left').css({'background':'url(images/left_bg'+(allbgindex%2)+'.jpg) no-repeat'});	
		$('#section_right').css({'background':'url(images/right_bg'+(allbgindex%2)+'.jpg) no-repeat'});	
}

var aa = setInterval("showTime()", 10000);*/