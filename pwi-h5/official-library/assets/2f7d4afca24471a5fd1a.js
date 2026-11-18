// JavaScript Document
/* 
	author:bianyuan;
	time:2010.11.21;
	website:http://bianyuan.me
*/
function tip(overClass, tipClass){
	function getEvent(event){//获取事件对象
	    return event ? event : window.event;
	}
	function getRelatedTarget(event){//获取相关对象
	    if(event.relatedTarget){
		    return event.relatedTarget;
		}else if(event.toElement){
		    return event.toElement;
		}else if(event.fromElement){
		    return event.fromElement;
		}else{
		    return null;
		}
	}
	function getElementsByClass(searchClass,node,tag) {
		var classElements = new Array();
		if ( node == null )
			node = document;
		if ( tag == null )
			tag = '*';
		var els = node.getElementsByTagName(tag);
		var elsLen = els.length;
		var pattern = new RegExp("(^|\\s)"+searchClass+"(\\s|$)");
		for (i = 0, j = 0; i < elsLen; i++) {
			if ( pattern.test(els[i].className) ) {
				classElements[j] = els[i];
				j++;
			}
		}
		return classElements;
	}
	var overArray = getElementsByClass(overClass),
		tipArray = getElementsByClass(tipClass),
		len = overArray.length;
	for (var i = 0; i < len; i++){(function(i){
			overArray[i].onmouseover = function(){//鼠标经过
				tipArray[i].style.display = 'block';
			}
			overArray[i].onmouseout = function(event){//鼠标移出经过区
				event = getEvent(event);
				var relatedTarget = getRelatedTarget(event);
				if (relatedTarget.className == tipClass){
					tipArray[i].style.display = 'block';
				}else{
					tipArray[i].style.display = 'none';
				}
			}
			tipArray[i].onmouseover = function(){//鼠标移动tip区
				tipArray[i].style.display = 'block';
			}
			tipArray[i].onmouseout = function(){//鼠标移出tip区
				tipArray[i].style.display = 'none';
			}
		})(i)	
	}
}