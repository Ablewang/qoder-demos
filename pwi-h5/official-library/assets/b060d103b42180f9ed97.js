/* ---------name:simulator--------------- */
/* ---------author:Zhoulichen------------ */
/* ---------copyright:www.wanmei.com ---- */
/* ---------time:2009.06.02-------------- */
/* ---------Email:zxzjob@yahoo.com.cn---- */

(function($) {
var istofull = false;
var max_jinqian = 0;//当前金钱全部变量
var max_yuanshen = 0;//当前元神全局变量
var max_dengji = 0;//当前等级全局变量
var Mouse = function(e){mouse = new MouseEvent(e);leftpos = mouse.x;toppos = mouse.y;}
var MouseEvent = function(e) {this.x = e.pageX;this.y = e.pageY;}		  

//火狐与ie兼容
function getEvent() {
	    return window.event || arguments.callee.caller.arguments[0];
    }

//选项卡关联
function kaash(el){
	$.each(boxmain.fz,function(i,n){
		$(n[1]).attr('className',n[3]);				   
		if(el == n[0]){$(n[1]).attr('className',n[2]);}				   
		});

	/*祝晨淼后期修改
	$.each(boxmain.fz,function(i,n){
		$(n[3]).attr('className',n[3]);				   
		//if(el == n[0]){$(n[1]).attr('className',n[2]);}	   
		});*/
	}
//选项卡
function kaa(){
	$('#'+boxmain.isxian).attr('className','issx');
	$.each(boxmain.fz,function(i,n){		   
		$(n[1]).attr('className',n[3]);
		if(boxmain.dq == n[0]){$(n[1]).attr('className',n[2]);}
		  //if(boxmain.name != 'wushi' && boxmain.name != 'cike'){
			$(n[1]).click(function(){
				kaash(n[0]);
				$('#isxian').attr('className','is'+n[0]);
				boxmain.dq = n[0];
				re();
				init();
			});
		  //}else{
			//	  $(n[1]).attr('className',n[3]);
		 // }
		});
	
	/*祝晨淼后期修改
	$('#'+boxmain.isxian).attr('className','issx');
	$.each(boxmain.fz,function(i,n){			   
		$(n[1]).attr('className',n[3]);
		if(boxmain.dq == n[0]){$(n[1]).attr('className',n[2]);}
		});*/
	}
	
//判断对象是否是数组	
function isArray(o) {return Object.prototype.toString.call(o) === '[object Array]';}
//将对转换成数组输出	
function getsize(obj){var sz = [];$.each(obj, function(i, n){sz.push(n);});	return [sz.length,sz];}

//字符串解析函数 str:传入的字符，nb:当前等级
function str_(str,nb){
	if(str.toString().indexOf('level') > 0){
		var level = nb;
		if(str.split("$").length > 2){
			return str.replace(/\$([^\$]+)\$/g, function(s){return Math.round(eval(s.replace(/\$/g, ''))*100)/100;});
			}else{
			return Math.round(eval(str)*100)/100;	
			}
	}else{
		return str;	
	}
}

//获取技能子对象
function getbox(obj){
	if(!obj){return false;}
	return {sp:$(obj.find('span.box_isshow')),dj:$(obj.find('span.box_nb')),im:$(obj.find('img'))};
	}

//求最大值
function get_max(){
	var dd = 0;
	$('.box').each(function(){
		var el = $(this);
		var dj =  parseInt(el.attr('dj'));
		if(dj > 0){
			var th = getbox(el);
			var da = {};
			if(el.attr('j') == '0'){da = el.data('da')}
			if(el.attr('j') == '1'){da = el.data('xm')}
			var js = da.dengji[dj-1];
			if(js > dd){ dd = js;}
		}
	});
	return dd;
	}

//遍历函数
function set_(){
	
	max_dengji = get_max();
	var zd = [];
	$('.box').each(function(i,n){
		var el = $(this);
		var th = getbox($(this));
		var da = el.data('da');
		var v = $.inArray(da.name,frist);
		
		if(v == -1){
			if(el.attr('dj') == '0'){
				//当最高等级大于元素当前等级，点亮
				if(max_dengji >= da.dengji[0]){
					el.attr('key','up');
					th.im.addClass('hand');
					th.sp.css({display:'none'})
				}
				
				//当最高等级大于元素当前等级，熄灭
				if(max_dengji <= da.dengji[0]){
					
					//解决数据缺钱bug
					if(da.dengji[0] > 95 && max_dengji >= 95){
						//alert(da.dengji[0]+'-'+max_dengji);
						el.attr('key','up');
						th.im.addClass('hand');
						th.sp.css({display:'none'});
					}else{
						el.attr('key','off');
						th.sp.css({display:'block'});
					}
				}
			}
		}	
	});

	}

//初始创建函数
function creat(){
	
	if ($('#box_show_div').length==0) {
			$('body').append('<div id="box_show_div" class="box_show">&nbsp;</div>');	
			$('#box_show_div').hide();
		}
	$.each(race,function(i,n){
		if(n.xianmo == '3'){
			var v = $.inArray(n.name,frist);
			var ma = n.nanber;
			var pb,ys,cl,key;
			var tb = '';
			if(v == -1){pb = 0;ys = 'display:block;';cl=' '; key = 'off'}else{
					pb = frist[v+1];
					ys = 'display:none;';
					cl=' class="hand" ';
					key = 'up';
					max_dengji = n.dengji[pb-1];
				}
			if(n.place[1] == 1){l = "0px";}else{l = (n.place[1]-1)*boxmain.width+"px";}
			if(n.place[0] == 1){t = "0px";}else{t = (n.place[0]-1)*boxmain.height+"px";}
			tb += '<div class="box" id="box_'+n.id+'" dj="'+pb+'" key="'+key+'" j="0" style="left:'+l+'; top:'+t+';">';
			tb += '<span class="box_isshow" style="'+ys+'"></span>';
			tb += '<span class="box_nb"><a>'+pb+'</a>/'+n.nanber+'</span>';
			tb += '<img src="'+boxmain.imgurl+boxmain.name+'/'+n.img+'" '+cl+'/>';	
			tb += '</div>';	
			$('#'+boxmain.box).append(tb)
			$('#box_'+n.id).data('da',n)
			$('#box_'+n.id).data('xm',false)
		}
	});
	
	$.each(race,function(i,n){
	//alert(boxmain.dq)
		//var zt = n.frelating;
		if(n.xianmo == '1' && boxmain.dq == 'sx'){ $('#box_'+n.frelating).data('xm',n);}
		if(n.xianmo == '2' && boxmain.dq == 'rm'){ $('#box_'+n.frelating).data('xm',n);}
		
		if(n.xianmo == '1'){$('#box_'+n.frelating).data('xxx',n);}
		if(n.xianmo == '2'){$('#box_'+n.frelating).data('mmm',n);}
		
	});
	
	//$('#'+boxmain.box).html(tb);
}


//显示弹出框
function sh(obj,i,xxx,mmm,tofull){
	if(!obj){ return false;}
	//var to = tobe(obj,i);
	var data = '<div class="box_jibie">';
	if(obj.name){data += '<h3 class="tit">'+obj.name+'</h3>';}
	if(obj.clas){data += boxmsg.m5+obj.clas;}
	if(obj.restrict){data += boxmsg.m6+obj.restrict;}
	if(obj.sitime){data += boxmsg.m10+obj.sitime[0]+boxmsg.m11+obj.sitime[1]+boxmsg.m12+obj.sitime[2];}
	if(obj.explain){data +=  boxmsg.m3+obj.explain;}
	//data += '<p>'+m+'<b>'+mi+'</b></p>';
	if(i>0){
		data += '<p>'+boxmsg.m8+i+'</p>';
		data += '<p>'+boxmsg.m10+str_(obj.zhunbei,i)/1000+'秒'+boxmsg.m12+str_(obj.jiange,i)/1000+'秒'+boxmsg.m11+str_(obj.shijian,i)/1000+'秒</p>';
		data += '<p>'+ boxmsg.m14 + boxmsg.m15 + str_(obj.zhenqi,i) +boxmsg.m16+ obj.yuanshen[i-1] +boxmsg.m17+ obj.jinqian[i-1]+'</p>';
		data += '<p>'+boxmsg.m19+obj.dengji[i-1]+' '+boxmsg.m20+obj.intm+'</p>';
		data += '<p>'+str_(obj.miaoshu,i)+'</p>';
		}
		
	if(i == 1){
		if(tofull){//仙-魔对比
			if(boxmain.dq == 'sx'){
				data += '<h3 class="tit"><span class="compare">'+mmm.name+'</span></h3>'+boxmsg.m5+mmm.clas+boxmsg.m6+mmm.restrict+'<p>'+boxmsg.m8+i+'</p><p>'+boxmsg.m10+str_(mmm.zhunbei,i)/1000+'秒'+boxmsg.m12+str_(mmm.jiange,i)/1000+'秒'+boxmsg.m11+str_(mmm.shijian,i)/1000+'秒</p>'+'<p>'+ boxmsg.m14 + boxmsg.m15 + str_(mmm.zhenqi,i) +boxmsg.m16+ mmm.yuanshen[i-1] +boxmsg.m17+ mmm.jinqian[i-1]+'</p>'+'<p>'+boxmsg.m19+mmm.dengji[i-1]+' '+boxmsg.m20+mmm.intm+'</p>'+'<p>'+str_(mmm.miaoshu,i)+'</p>';
			}
			if(boxmain.dq == 'rm'){
				data += '<h3 class="tit"><span class="compare">'+xxx.name+'</span></h3>'+boxmsg.m5+xxx.clas+boxmsg.m6+xxx.restrict+'<p>'+boxmsg.m8+i+'</p><p>'+boxmsg.m10+str_(xxx.zhunbei,i)/1000+'秒'+boxmsg.m12+str_(xxx.jiange,i)/1000+'秒'+boxmsg.m11+str_(xxx.shijian,i)/1000+'秒</p>'+'<p>'+ boxmsg.m14 + boxmsg.m15 + str_(xxx.zhenqi,i) +boxmsg.m16+ xxx.yuanshen[i-1] +boxmsg.m17+ xxx.jinqian[i-1]+'</p>'+'<p>'+boxmsg.m19+xxx.dengji[i-1]+' '+boxmsg.m20+xxx.intm+'</p>'+'<p>'+str_(xxx.miaoshu,i)+'</p>';
			}
		}
	}
	
	if(i>1){
		data += '<p>'+boxmsg.m7+(i-1)+'</p>';
		data += '<p>'+boxmsg.m10+str_(obj.zhunbei,i-1)/1000+'秒'+boxmsg.m12+str_(obj.jiange,i-1)/1000+'秒'+boxmsg.m11+str_(obj.shijian,i-1)/1000+'秒</p>';
		data += '<p>'+ boxmsg.m14 + boxmsg.m15 + str_(obj.zhenqi,i-1) +boxmsg.m16+ obj.yuanshen[i-2] +boxmsg.m17+ obj.jinqian[i-2]+'</p>';
		data += '<p>'+boxmsg.m19+obj.dengji[i-2]+' '+boxmsg.m20+obj.intm+'</p>';
		data += '<p>'+str_(obj.miaoshu,i-1)+'</p>';
		}
	if(i<obj.nanber){
		data += '<p>'+boxmsg.m9+(i+1)+'</p>';
		data += '<p>'+boxmsg.m10+str_(obj.zhunbei,i+1)/1000+'秒'+boxmsg.m12+str_(obj.jiange,i+1)/1000+'秒'+boxmsg.m11+str_(obj.shijian,i+1)/1000+'秒</p>';
		data += '<p>'+ boxmsg.m14 + boxmsg.m15 + str_(obj.zhenqi,i+1) +boxmsg.m16+ obj.yuanshen[i] +boxmsg.m17+ obj.jinqian[i]+'</p>';
		data += '<p>'+boxmsg.m19+obj.dengji[i]+' '+boxmsg.m20+obj.intm+'</p>';
		data += '<p>'+str_(obj.miaoshu,i+1)+'</p>';
		}
	//data += '<p>'+arra[3]+'</p>';
	//data += typeof to[1] == 'string'?to[1]: cs(to[1],boxmsg.m8,i);
	//if(to[0]){data += cs(to[0],boxmsg.m7,i-1);}
	//if(to[2]){data += cs(to[2],boxmsg.m9,i+1);}
	data += boxmsg.m13;
	data += '</div>';
	
	$('#box_show_div').html(data);
	//alert(data);
	}

//加点函数
function jia(el,i){
	var da = el.data('da');
	var xm = el.data('xm');
	var xxx = el.data('xxx');
	var mmm = el.data('mmm');
	var the = getbox(el);
	var ii = i+1;
	var dian;
	if(ii > da.nanber && xm /*!= false*/){
		i = 1;
		el.attr('key','dow');
		el.attr('dj','1');
		el.attr('j','1');
		the.sp.css({display:'none'})
		the.dj.html('<a>'+i+'</a>/'+xm.nanber);
		the.im.attr('src',boxmain.imgurl+boxmain.name+'/'+xm.img);
		set_();
		el.attr('istofull','1');
		//istofull = true;
		sh(xm,i,xxx,mmm,true);
		show_(xm,i,'jia');
	//show_(da,ii,'jia');
		return;
	}
	
	if(ii == da.nanber){
		if(xm == false){
			el.attr('key','dow');
		}
	}else{el.attr('key','all');}

	if(ii < da.nanber){}
	el.attr('dj',ii);
	the.dj.html('<a>'+ii+'</a>/'+da.nanber);
	set_();
	sh(da,ii,xxx,mmm);
	show_(da,ii,'jia');
}

//底部结果输出
function show_(obj,i,is){
if(obj && i){
	if(is == 'jia'){
		max_jinqian += obj.jinqian[i-1];
		max_yuanshen += obj.yuanshen[i-1];
		//if(max_dengji < obj.dengji[i-1]){max_dengji = obj.dengji[i-1]}
		}
	if(is == 'jian'){
		max_jinqian -= obj.jinqian[i-1];
		max_yuanshen -= obj.yuanshen[i-1];
		//if(max_dengji < obj.dengji[i]){max_dengji = obj.dengji[i-1]}
		}
	}
	$('#'+boxmain.dengji).html(max_dengji);
	$('#'+boxmain.jinqian).html(max_jinqian);
	$('#'+boxmain.yuanshen).html(max_yuanshen);
	}

//减点函数
function jian(el,i){
	var da = el.data('da');
	var xm = el.data('xm');
	var xxx = el.data('xxx');
	var mmm = el.data('mmm');
	var the = getbox(el);
	var ii = i-1;
	
	var min_p = 0;
	var v = $.inArray(da.name,frist);
	if(v != -1 ) {min_p = frist[v+1];}
	
	istofull = false;
	
	if(el.attr('j') == '1'){
		ii = da.nanber;
		el.attr('key','all');
		el.attr('dj',ii);
		el.attr('j','0');
		the.dj.html('<a>'+ii+'</a>/'+da.nanber);
		the.im.attr('src',boxmain.imgurl+boxmain.name+'/'+da.img);
		set_();
		sh(da,ii,xxx,mmm);
		show_(xm,i,'jian');
		//show_(da,i,'jian');
		return;
		}
		
		if(da.name == frist[0]){}
		if(ii > min_p){
			el.attr('key','all');
			}
		if(ii == min_p){
			el.attr('key','up');
			}
		el.attr('dj',ii);
		the.dj.html('<a>'+ii+'</a>/'+da.nanber);
		set_();
		sh(da,ii,xxx,mmm);
		show_(da,i,'jian');
	}


//清理函数
function re(){
	max_dengji = 0;
	max_jinqian = 0;
	max_yuanshen = 0;
	show_(false,false);
	$('#'+boxmain.box).empty();
	}

//启动函数
function init(){
		
		creat();//创建视图区域
		show_(false,false);//创建底部统计信息
		bd();//绑定事件
		$('#'+boxmain.resete).bind('click',function(){
			re();
			creat();//创建视图区域
			show_(false,false);//创建底部统计信息
			bd();
		});
	}

function bd(){
			var b = $('#box_show_div');
			$('.box').bind('mouseover',function(e){
				var xxx = $(this).data('xxx');
				var mmm = $(this).data('mmm');
				Mouse(e);
				b.css({top:toppos+12,left:leftpos+12}).show();
				var sj;
				var el = $(this).attr('j');
				if(el == '0'){sj = $(this).data('da');}
				if(el == '1'){sj = $(this).data('xm');}
				var tototo = $(this).attr('istofull')
				 sh(sj,parseInt($(this).attr('dj')),xxx,mmm,tototo);
				 
				 /*祝晨淼后期修改*/
				var e1 = getEvent();
				mouseX = e1.clientX;
				mouseY = e1.clientY;
				if(document.documentElement.clientHeight<mouseY+$('#box_show_div').height()){
					$('#box_show_div').css('top',mouseY-(mouseY+$('#box_show_div').height()-document.documentElement.clientHeight)+$(document).scrollTop()-10);
				}
			}).bind('mousemove',function(e){Mouse(e);b.css({top: toppos+8,left: leftpos+8});
			
				/*祝晨淼后期修改*/
				var e1 = getEvent();
				mouseX = e1.clientX;
				mouseY = e1.clientY;
				if(document.documentElement.clientHeight<mouseY+$('#box_show_div').height()){
					$('#box_show_div').css('top',mouseY-(mouseY+$('#box_show_div').height()-document.documentElement.clientHeight)+$(document).scrollTop()-10);
				}
			}).bind('mouseout',function(){b.html(' ').hide();//显示弹出层
			}).bind('mousedown',function(e){
				var id = parseInt($(this).attr('dj'));
				var da = $(this).data('da');
				var key = $(this).attr('key');
				if(key == 'off'){return false;};
				
				if(key == 'up' || key == 'all'){
					if(2 == 2 ){
						//点击右键
						if(e.which == 1){
							jia($(this),id)
							//alert('左键');
						}
					}
				}
				
				if(key == 'dow' || key == 'all'){
					//点击右键
					if(e.which == 3 || e.which == undefined){//兼容TT浏览器
						jian($(this),id);
					}
				}
		}).bind('contextmenu', function() { return false; });
	}


$(document).ready(function(){
		init();
		kaa();
		$('#dayin').bind('click',function(){window.print();});
	});

})(jQuery);