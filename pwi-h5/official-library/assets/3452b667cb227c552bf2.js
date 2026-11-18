/* ---------name:simulator--------------- */
/* ---------author:Zhoulichen------------ */
/* ---------copyright:www.wanmei.com ---- */
/* ---------time:2009.06.02-------------- */
/* ---------Email:zxzjob@yahoo.com.cn---- */
var boxmain = {
	box:"box", 
	name:"wuxia",
	chang:7, 
	gao:9, 
	height:63,
	width:63,
	pint:'dayin',
	resete:'reset',
	explain:'shuoming', 
	yuanshen:'yuanshen',
	dengji:'dengji',
	jinqian:'jinqian',
	isxian:'isxian',
	imgurl:"images/",
	urlname:'race',
	dq:'sx',
	fz:[['sx','#shengxian','xian','xian1'],['rm','#rumo','rumo','rumo1']],
	getsize: function(obj){var sz = [];$.each(obj, function(i, n){sz.push(n);});return [sz.length,sz];}
	}
	
	
var boxmsg = {
	m1:'<p>提示：你还没有学习该技能！</p>',
	m2:'你已经到达该技能的最高等级！',
	m3:'<p>说明：</p>',
	m4:'<p>备注：</p>',
	m5:'<span>技能类型：</span>',
	m6:' <span> 武器限制：</span>',
	m7:'<b>上一等级：</b>',
	m8:'<b>当前等级：</b>',
	m9:'<b>下一等级：</b>',
	m10:' <span>准备时间：</span>',
	m11:' <span> 释放时间：</span>',
	m12:' <span> 释放间隔：</span>',
	m13:'<p class="mou"><span class="cr">点击鼠标左键学习</span><span class="cb">点击鼠标右键取消</span></p>',
	m14:'<span>消耗：</span>',
	m15:'<span> 真气 </span>',
	m16:'<span> 元神 </span>',
	m17:'<span> 金钱 </span>',
	m18:'<span> 转 </span>',
	m19:'<span>所需人物等级：</span>',
	m20:'<span>修真等级：</span>'
	}
	
