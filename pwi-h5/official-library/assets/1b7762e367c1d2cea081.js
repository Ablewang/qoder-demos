//取FLASH值
function getResult(_result){change(_result);}
//比较FLASH值与天赋容器NAME值
function compare(g,h){
	
	h = h.split(',');
	for(i=0;i<5;i++)
	{
		if(h[i] > g[i]){ return false;}
	}	
	return true ;
}
//天赋容器变化
function change(nb){
	$('.skill').each(function(i,n){
	
	var skillname = $(n).attr('name');
	var skillid = $(n).attr('id');
	var skillp = '#p'+skillid;
	var skillimg = '<img id="'+skillid+'" src="images/'+skillid+'.jpg"/>';
	if(skillname){
		if(compare(nb,skillname)){
			$(n).empty().append(skillimg);
			$(skillp).clone().appendTo(n);
			$(n).addClass('pin');
			$(this).attr('zt','yes')
		}else{
			$(this).attr('zt','no');
			$(n).empty();
		}
		
	}
	});
	
	$('.skill img').mouseover(function(){
		var imgid=$(this).attr("id");
		var pid='#p'+imgid;
		$(pid).show();
	});
	$('.skill img').mouseout(function(){
		var imgid=$(this).attr("id");
		var pid='#p'+imgid;
		$(pid).hide();
	});
}

var data_main = {
	da:eval('skill1_5'),
	dj:1,
	zt:'no'
	};

function jia_(n){
	if(n >= 10){
		alert('已到最高等级！');
		return false;
		}else{
			data_main.dj = n+1
			cr_info();
			}
	
	}
function jian_(n){
		if(n <= 1){
		alert('已到最低等级！');
		return false;
		}else{
			data_main.dj = n-1
			cr_info();
			}
	}

function cr_info(){
	var el = data_main.da;
	var nb = data_main.dj - 1;
	var zt = data_main.zt;
	var str = "";
	if(zt == 'no'){str += '<h1 style="color:#F00;">当前天赋模拟器配点与技能需求元素点不符</h1>';}
	if(zt == 'yes'){str += '<h1>当前天赋模拟器配点与技能需求元素点一致</h1>';}

	str += '<div id="info">'
	str += '<div id="info-btn">'
	str += '<div class="center"><img src="images/btn1.jpg" style="cursor:pointer;" onclick="jia_('+data_main.dj+')"/><img src="images/btn2.jpg" onclick="jian_('+data_main.dj+')" style="cursor:pointer;" /></div>'
	str += '<div class="text">'
	str += '技能等级：<b>'+el.info[nb].dengji+'</b><br />'
	str += '精灵学习等级：<b>'+el.info[nb].j_dengji+'</b><br />学习时消耗元神：<b>'
	str += el.info[nb].yuanshen+'</b><br />'
	str += '施放时消耗能量：<b>'
	str += el.info[nb].nengliang+'</b><br />'
	str += '施放时消耗体力：<b>'
	str += el.info[nb].tili
	str += '</b></div>'
	str += '</div>'
	
	str += '<h2><img src="images/'+el.id+'.jpg" style="height:38px; width:38px;"/></h2>';
	str += '<br/><strong>技能名称：</strong><br/>'+el.name+'<br />';
	str += '<strong>需求元素点：</strong><br />';
	str += el.yuansu+'<br />';
	str += '<strong>施放距离：</strong><br/>'+el.info[nb].juli+'<br />';
	str += '<strong>施放时间：</strong><br/>'+el.shijian+'<br />';
	str += '<strong>施放间隔：</strong>'+el.jiange+'<br />';
	str += '<strong>职业限制：</strong>'+el.zhiye+'<br />';
	str += '<strong>使用范围：</strong>'+el.teshu+'<br />';
	str += '<strong>技能加点：</strong>'+el.info[nb].jiadian+'<br />';
	str += '<strong>技能描述：</strong>'+el.info[nb].miaoshu;
	str += '</div>';
	
	
	$('#left-info').html(str);	
	}


$(document).ready(function(){
	//初始化所有技能点，绑定数据
	
	$('.skill').each(function(){
								  $(this).attr('dj','1');
								  $(this).attr('zt','no');
								  $(this).css({cursor:'pointer'});
							  });
	cr_info();
	$('.skill').bind('click',function(){
		 data_main.da = eval($(this).attr('id'));
		 data_main.dj = $(this).attr('dj');
		 data_main.zt = $(this).attr('zt');
		 cr_info();
	})						   			   
});


