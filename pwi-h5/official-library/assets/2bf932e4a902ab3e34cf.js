

var XMLPath;
var xmlDoc = null;
var provinceDropDownList = document.getElementById("province");
var cityDropDownList = document.getElementById("city");
var countyDropDownList = document.getElementById("county");

XMLPath = "Area.xml";

//方法：初始化省份的下拉列表框
function InitProvince(){
	var xmlNodes;
	//判断浏览器类型
	if(window.ActiveXObject){	//在IE浏览器环境下
		xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
		xmlDoc.async = "false";
		xmlDoc.load(XMLPath);
		xmlNodes = xmlDoc.selectSingleNode("root").childNodes;
		for(var i = 0; i < xmlNodes.length; i ++){
			var provinceNode = xmlNodes[i].getAttribute("name");
			var pOption = document.createElement("option");
			pOption.value = provinceNode;
			pOption.text = provinceNode;
			provinceDropDownList.add(pOption);
		}
		
		InitCity();
	}
	else if(document.implementation && document.implementation.createDocument){		//在非IE浏览器环境下
		/*xmlDoc = document.implementation.createDocument("","",null);
		xmlDoc.load(XMLPath);
		xmlDoc.async = false;*/
		var xmlhttp = new window.XMLHttpRequest();
		xmlhttp.open("GET", XMLPath, false);
		xmlhttp.send(null);
		xmlDoc = xmlhttp.responseXML.documentElement;
		//alert(xmlDoc)
		//xmlDoc.onload = function(){
			xmlNodes = xmlDoc.getElementsByTagName("province");
			for(var i = 0; i < xmlNodes.length; i ++){
				var provinceNode = xmlNodes[i].getAttribute("name");
				var pOption = document.createElement("option");
				pOption.innerHTML = provinceNode;
				pOption.setAttribute("value",provinceNode);
				provinceDropDownList.appendChild(pOption);
			}
			/* 初始化下级列表的过程必须放在
			 * XML文件的装载事件中，否则在初始化下
			 * 级列表的函数中无法获取上级列表的值
			 */
			InitCity();
		//}
	}
}

//初始化市级下拉列表框
function InitCity(){
	var provinceNodeTxt = provinceDropDownList.value;
	var cityNodes;
	
	if(window.ActiveXObject){
		var provinceNode = xmlDoc.selectSingleNode('//root/province [@name="' + provinceNodeTxt +'"]');
		cityNodes = provinceNode.childNodes;
		cityDropDownList.innerHTML = "";
		
		for(var i = 0; i < cityNodes.length; i ++){
			var cityNode = cityNodes[i];
			var cOption = document.createElement("option");
			cOption.value = cityNode.getAttribute("name");
			cOption.text = cityNode.getAttribute("name");
			cityDropDownList.add(cOption);
		}
		
		if(cityNodes.length == 0){
			var cOption = document.createElement("option");
			cOption.value = "";
			cOption.text = "无市级辖区";
			cityDropDownList.add(cOption);
		}
		
		InitCounty();
	}
	else if(document.implementation && document.implementation.createDocument){
		var xmlDoc1 = null;
		/*xmlDoc1 = document.implementation.createDocument("","",null);
		xmlDoc1.load(XMLPath);
		xmlDoc1.async = false;*/
		var xmlhttp = new window.XMLHttpRequest();
		xmlhttp.open("GET", XMLPath, false);
		xmlhttp.send(null);
		xmlDoc1 = xmlhttp.responseXML.documentElement;
		
		//xmlDoc1.onload = function(){		
			var provinceNodes = xmlDoc1.getElementsByTagName("province");
			var provinceNode = null;
		
			for(var i = 0; i < provinceNodes.length; i ++){
				if(provinceNodes[i].getAttribute("name") == provinceNodeTxt){
					provinceNode = provinceNodes[i];
					break;
				}
			}
			
			cityNodes = provinceNode.getElementsByTagName("city");
			cityDropDownList.innerHTML = "";
			
			for(var i = 0; i < cityNodes.length; i ++){
				var cityNode = cityNodes[i];
				var cOption = document.createElement("option");
				cOption.innerHTML = cityNode.getAttribute("name");
				cOption.setAttribute("value",cityNode.getAttribute("name"));
				cityDropDownList.appendChild(cOption);
			}
			
			if(cityNodes.length == 0){
				var cOption = document.createElement("option");
				cOption.innerHTML = "无市级辖区";
				cOption.setAttribute("value","");
				cityDropDownList.appendChild(cOption);
			}
			
			/* 初始化下级列表的过程必须放在
			 * XML文件的装载事件中，否则在初始化下
			 * 级列表的函数中无法获取上级列表的值
			 */
			InitCounty();
		//}
	}
}

//初始化县级下拉列表
function InitCounty(){
	var cityNodeTxt = cityDropDownList.value;
	var provinceTxt = provinceDropDownList.value;
	var countyNodes;
	
	if(window.ActiveXObject){
		document.getElementById("county").innerHTML = "";
		
		if(cityNodeTxt != ""){
			var cityNode = xmlDoc.selectSingleNode('//root/province [@name="' + provinceTxt + '"]/city [@name="' + cityNodeTxt + '"]');
			countyNodes = cityNode.childNodes;
		
			for(var i = 0; i < countyNodes.length; i ++){
				var countyNode = countyNodes[i];
				var ctOption = document.createElement("option");
				ctOption.value = countyNode.getAttribute("name");
				ctOption.text = countyNode.getAttribute("name");
				countyDropDownList.innerHTML = countyNode.getAttribute("name");;
			}
			
			if(countyNodes.length == 0){
				var ctOption = document.createElement("option");
				ctOption.value = "";
				ctOption.text = "无县级辖区";
				countyDropDownList.innerHTML = "无县级辖区";
			}
		}
		else{
			var ctOption = document.createElement("option");
			ctOption.value = "";
			ctOption.text = "无县级辖区";
			countyDropDownList.innerHTML = "无县级辖区";
		}
	}
	else if(document.implementation && document.implementation.createDocument){
		countyDropDownList.innerHTML = "";
		
		if(cityNodeTxt == ""){
			var ctOption = document.createElement("option");
			ctOption.innerHTML = "无县级辖区";
			ctOption.setAttribute("value","");
			countyDropDownList.innerHTML = "无县级辖区";
		}
		else{
			var xmlDoc1 = null;
		//	xmlDoc1 = document.implementation.createDocument("","",null);
		//	xmlDoc1.load(XMLPath);
		//	xmlDoc1.async = false;
			var xmlhttp = new window.XMLHttpRequest();
			xmlhttp.open("GET", XMLPath, false);
			xmlhttp.send(null);
			xmlDoc1 = xmlhttp.responseXML.documentElement;
			
			//xmlDoc1.onload = function(){
				var provinceNodes = xmlDoc1.getElementsByTagName("province");
				var provinceNode = null;
				var cityNodes;
				var cityNode;
				var countyNodes;
				
				//查找当前省级节点
				for(var i = 0; i < provinceNodes.length; i ++){
					if(provinceNodes[i].getAttribute("name") == provinceTxt){
						provinceNode = provinceNodes[i];
						break;
					}
				}
				//查找当前市级节点
				cityNodes = provinceNode.getElementsByTagName("city");
				
				for(var i = 0; i < cityNodes.length; i ++){
					if(cityNodes[i].getAttribute("name") == cityNodeTxt){
						cityNode = cityNodes[i];
					}
				}
				
				countyNodes = cityNode.getElementsByTagName("county");
				
				//判断当前市级节点是否存在下级节点
				if(countyNodes.length == 0){
					var ctOption = document.createElement("option");
					ctOption.innerHTML = "无县级辖区";
					ctOption.setAttribute("value","");
					countyDropDownList.innerHTML = "无县级辖区";
				}
				else{	//当前市级节点存在下级节点
					countyDropDownList.innerHTML = "";
					
					//创建县级列表项并添加
					for(var i = 0; i < countyNodes.length; i ++){
						var ctOption = document.createElement("option");
						ctOption.innerHTML = countyNodes[i].getAttribute("name");
						ctOption.setAttribute("value",countyNodes[i].getAttribute("name"));
						countyDropDownList.innerHTML = countyNodes[i].getAttribute("name");
					}
				}
			//}
		}
	}
}

function _submit(){
	var province = provinceDropDownList.value;
	var city = cityDropDownList.value;
	var county = countyDropDownList.innerHTML;
	
	alert(province + " " + city + " " + county);
	
	return false;
}

//以下是对相应的事件添加具体的过程
window.onLoad = InitProvince();
provinceDropDownList.onclick = InitCity;
provinceDropDownList.onchange = InitCity;
cityDropDownList.onclick = InitCounty;
cityDropDownList.onchange = InitCounty;