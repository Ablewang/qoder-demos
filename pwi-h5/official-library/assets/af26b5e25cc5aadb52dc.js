function $id(id){return document.getElementById(id)};
var objFunction = function(){
	function elem(id){
		var elem = id.firstChild;
		while(elem.nodeType !=1){
			elem = id.nextSibling;
			continue;
		}
		return elem;
	};
	function toggle(n){
		var len= $id("ntab").getElementsByTagName("li");
		for(var i=0;i<len.length;i++){
			var elment = elem(len[i]);
			elment.className="str-"+i;
			$id("show"+i).style.display="none";
		}
		var elements = elem(len[n]);
		elements.className="str-s-"+n;
		$id("show"+n).style.display="block";
	}
	return{
		toggle:function(n){
			toggle(n);
		}	
	}
}();
//
var showBox = function(){
	var str = window.location.href,
		href = parseInt(str.substr(str.length-1,1));
	switch(href)
	{
		case 0:
		 objFunction.toggle(0);
		 break
		case 1:
		  objFunction.toggle(1);
		  break
		case 2:
		   objFunction.toggle(2);
		  break
		  case 3:
		   objFunction.toggle(3);
		  break
		  case 4:
		   objFunction.toggle(4);
		  break
		  case 5:
		   objFunction.toggle(5);
		  break
		  case 6:
		   objFunction.toggle(6);
		  break
		 default:
		 	
	}
}	
showBox()
