wm.fastreg({
  box: 'fastreg', 
  game: 'w2i', 
  css: 1,
  card:'',
  wmrid: "RP42970167"
});
/*wm.fastreg({
  box: 'fastreg_box', 
  game: 'w2i', 
  css: 1,
  card:'',
  wmrid: "RP42970167"
});*/
    $(function ($) {
    	var i=0,
			mainH = $("#wrap").height();
		$("#left").height(mainH);
		$('.closebtn ,.regshow_btn').click(function(){
			var thisClass = $(this).attr("class");
			if(i==0){
				i=1;
				$(".regshow_btn").addClass("regshow_btn2");
				$('#flart_regbar').stop().animate({'width':'0px'},500,function(){
					$('#regbox').hide();
					$('#flart_regbar').css('width','44px');
				});
				$('.regshow_btn').stop().animate({"right":0},500);
			}else{
				i=0;
				$(".regshow_btn").removeClass("regshow_btn2");
				$('#flart_regbar').css('width','0px');
				$('#regbox').show();
				$(this).attr("class","regshow_btn");
				$('#flart_regbar').stop().animate({'width':'244px'},500);
				$('.regshow_btn').stop().animate({"right":244},500);
			}
		});
        $('.btn_bar2').click(function () {
            flart_regbarS();
            
        });
		$('.btn_bar').click(function () {
                fkai();
        });	
		function flart_regbarS(){
			$('#flart_regbar').stop().animate({ 'width': '0px' }, 500, function () {
                $('#regbox').hide();
                $('#flart_regbar').css('width', '44px');
                $('.btn_bar').css('right', '0px');
                $(".btn_bar2").hide();
                $(".btn_bar").show();
            });
		}
		
		function fkai(){
			$('.btn_bar').css('right', '244px');
			$('#flart_regbar').css('width', '0px');
			$('#regbox').show();
			$('#flart_regbar').stop().animate({ 'width': '244px' }, 500);
			$(".btn_bar").hide();
            $(".btn_bar2").show();
		}
        
		setTimeout(flart_regbarS,2000)
        
        $("#regBtn2,.xslb,.libaobtn").click(function(){
			fkai();
			$('#showdiv').show();
			/*$.simpleDialog({
			   skin:false,
			   content: '#showdiv',
			   id : 'showdiv'
			});*/
        });
        
        $(".jklq").click(function(){
			$('#showdiv').hide();
            //$.simpleDialog.close('showdiv');
            var pos = $('#fastreg').offset();
			/*$.simpleDialog({
			   skin:false,
			   content: '#showdiv2',
			   id : 'showdiv2',
			   fixed: false,
				afterShow: function(){
					this.boxy.css({left:pos.left,top:300})
				}
			});*/
			$('#showdiv2').show().css({left:pos.left,top:300});
			$('html,body').animate({'scroll-top':10});
        });
		
		$(".kaiguan").click(function(){
			//$.simpleDialog.close('showdiv');
			$('#showdiv').hide();	
        });
		  
        $(".closereg").click(function(){
			//$.simpleDialog.close('showdiv2');
			$('#showdiv2').hide();
        });		
    });