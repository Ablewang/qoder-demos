var Slider = function(options) {
  this.defaults = {
    node: ".slider",
    effect: "fade",
    speed: "normal",
    easing: "easeInOutExpo",
    auto: false,
    delay: 3000,
    onInit: function() {},
    beforeMove: function() {},
    afterMove: function() {}
  };
  $.extend(this.defaults, options);

  this.$div = $(this.defaults.node);
  this.$ul = $(".slider_inner", this.$div);
  this.$li = $(".slider_item", this.$div);
  this.length = this.$li.size();
  this.index = 0;
  this.init();
};

Slider.prototype = {
  init: function() {
    this.width = this.$li.width();
    if (this.defaults.effect == "fade") {
      this.$li.hide().eq(0).show();
    }
    if (this.defaults.effect == "left") {
      this.$div.css("width", this.width);
      this.$ul.css("width", this.width * this.length);
    }
    this.defaults.onInit(this);
    if (this.defaults.auto === true) {
      this.autoPlay();
    }
  },
  move: function() {
    this.defaults.beforeMove(this);
    if (this.defaults.effect == "fade") {
      this.fade();
    }
    if (this.defaults.effect == "left") {
      this.scrollLeft();
    }
  },
  fade: function() {
    var self = this;
    this.$li.filter(":visible").fadeOut(200).end().eq(this.index).fadeIn(250,
    function() {
      self.defaults.afterMove(self);
    });
  },
  scrollLeft: function(callback) {
    var self = this;
    var p = -1 * this.index * this.width;
    this.$ul.stop().animate({
      "margin-left": p
    },
    this.defaults.speed, this.defaults.easing,
    function() {
      self.defaults.afterMove(self);
    });
  },
  setPosition: function(index) {
    this.index = index;
    this.defaults.beforeMove(this);
    if (this.defaults.effect == "fade") {
      this.$li.hide().eq(this.index).show();
    }
    if (this.defaults.effect == "left") {
      var p = -1 * this.index * this.width;
      this.$ul.css("margin-left", p);
    }
    this.defaults.afterMove(this);
  },
  autoPlay: function() {
    var self = this;
    this.stop();
    this.timer = setInterval(function() {
      self.goNext();
    },
    this.defaults.delay);
  },
  stop: function() {
    clearInterval(this.timer);
  },
  goPrev: function() {
    this.index = this.index > 0 ? this.index - 1 : this.length - 1;
    this.move();
  },
  goNext: function() {
    this.index = this.index < this.length - 1 ? this.index + 1 : 0;
    this.move();
  }
};

var app = {
  dir: "center",// left | center | right
  side_width: 472,
  item_width: 1680,
  margin: 0,
  speed: 1000,
  lslide: null,
  rslide: null,
  iframe: null,
  easing: "easeInOutExpo",
  init: function() {
    $(window).resize(function() {
      app.resize();
    }).scroll(function() {
      var top = $(window).scrollTop() + 500;
      $(".slider_next,.slider_prev,.loading").css("top", top);
    }).trigger("resize");

    $("#container iframe").load(function() {
      this.height = 1000;
      app.iframe = this;
      $("#" + app.dir + "_slide .loading").hide();
    });

    app.autoHeight();
  },
  getWinSize: function() {
    return {
      width: $(window).width(),
      height: $(document).height(),
      scrollTop: $(window).scrollTop(),
      scrollLeft: $(window).scrollLeft()
    };
  },
  autoHeight: function() {
    window.setInterval(function() {
      var iframe = app.iframe;
      if (iframe) {
        try {
         /* var bHeight = iframe.contentWindow.document.body.scrollHeight;
          var dHeight = iframe.contentWindow.document.documentElement.scrollHeight;
          var height = Math.max(bHeight, dHeight);
				*/
					var height;
					if (iframe.contentDocument && iframe.contentDocument.body.offsetHeight){
						height = iframe.contentDocument.body.offsetHeight;
					}
					else if (iframe.Document && iframe.Document.body.scrollHeight){
						height = iframe.Document.body.scrollHeight;
					}
          iframe.height = height;
		  
          height = (height < 1010 ? 1010 : height) + 100;
		  //console.log(height)
          $("#section_right,#section_left,#side,#wrap").height(height);
        } catch(e) {}
      }
    },
    200);
  },
  setBtnStatus: function(id, slide) {
    var $prev = $("#" + id + "_slide_prev");
    var $next = $("#" + id + "_slide_next");
    $prev.show();
    $next.show();
    if (slide.index == 0) {
      $prev.hide();
    }
    if (slide.index == slide.length - 1) {
      $next.hide();
    }
		$("#side .on").removeClass("on");
    $("a[action=" + id + "-" + slide.index + "]").addClass("on");
  },
  animate: function(dir, index) {
    app.dir = dir;
    var screen_width = app.getWinSize().width;
    if (app.dir == "left") {
      $('#side').animate({
        left: screen_width - app.side_width - app.margin
      },
      app.speed, app.easing);
      $("#container").animate({
        left: -(app.item_width + app.side_width / 2 - screen_width + app.margin)
      },
      app.speed, app.easing,
      function() {
        $("#left_slide").show();
        $("#right_slide").hide();
        if (!app.lslide) {
          app.lslide = new Slider({
            node: "#left_slide .slider",
            effect: "left",
            beforeMove: function(slide) {
              app.setBtnStatus("left", slide);
              var $box = slide.$li.eq(slide.index);
              var src = $box.attr("data-src");
              $("iframe", $box).attr("src", src);
              $("#left_slide .loading").show();
            }
          });
          $("#left_slide_prev").click(function() {
            app.lslide.goPrev();
          });
          $("#left_slide_next").click(function() {
            app.lslide.goNext();
          });
        }
        app.lslide.setPosition(index);
      });
    }
    if (app.dir == "right") {
      $('#side').animate({
        left: app.margin
      },
      app.speed, app.easing);
      $("#container").animate({
        left: -(app.item_width - app.side_width / 2) + app.margin
      },
      app.speed, app.easing,
      function() {
        $("#left_slide").hide();
        $("#right_slide").show();
        if (!app.rslide) {
          app.rslide = new Slider({
            node: "#right_slide .slider",
            effect: "left",
            beforeMove: function(slide) {
              app.setBtnStatus("right", slide);
              var $box = slide.$li.eq(slide.index);
              var src = $box.attr("data-src");
              $("iframe", $box).attr("src", src+"?t="+(+new Date()));
              $("#right_slide .loading").show();
            }
          });
          $("#right_slide_prev").click(function() {
            app.rslide.goPrev();
          });
          $("#right_slide_next").click(function() {
            app.rslide.goNext();
          });
        }
        app.rslide.setPosition(index);
      });
    }
  },
  goto: function(dir, index) {
		if(app.dir == "center"){
			$("#top_flash").hide();
		}
    if (app.dir == dir) {
      var slide = app[{"left": "lslide","right": "rslide"}[dir]];
      slide.index = index;
      slide.move();
    } else {
      app.animate(dir, index);
    }
  },
  resize: function() {
    var screen_width = app.getWinSize().width;
    switch (app.dir) {
    case "left":
      $("#side").css("left", screen_width - app.side_width - app.margin);
      $("#container").css("left", -(app.item_width + app.side_width / 2 - screen_width + app.margin));
      break;
    case "center":
      $("#side").css("left", (screen_width - app.side_width) / 2);
      $("#container").css("left", screen_width / 2 - app.item_width);
			$("#top_flash").css("left", (screen_width - 1001) / 2);
      break;
    case "right":
      break;
    }
  }
};

$(document).ready(function(e) {

  app.init();

  $("#btn_signup").click(function() {
    app.goto("right", 0);
  });
  $(".xinfu_box a").click(function() {
    var str = $(this).attr("action");
    if (str != "") {
      var s = str.split("-");
      app.goto(s[0], parseInt(s[1]));
    }
  });
  
  var m = window.location.hash;
  var map= {
		"signup_guide":"right-0",
		"event_process":"right-1",
		/*"event_description":"right-2",*/
		"guild_list":"right-3",
		"red_emperor":"right-2",
		/*"world_schedule":"left-1",*/
		"prizes_show":"left-1",
		"events_quiz":"left-2",
		"events_report":"left-3"
	};
	if(m){
		m = m.substr(1);
		if(m in map){
			var s = map[m].split("-");
    	app.goto(s[0], parseInt(s[1]));
		}
	}
	
  /*var ad_slide = new Slider({
    node: "#ad_slide",
    onInit: function(ad) {
      $("#ad_slide_prev").click(function() {
        ad.goPrev();
      });
      $("#ad_slide_next").click(function() {
        ad.goNext();
      });
    }
  });*/

  if ($.browser.msie && $.browser.version == "6.0") {
    try {
      document.execCommand("BackgroundImageCache", false, true);
    } catch(e) {}
  }
	
});



         $(function(){
         $("#btn5,.pop_reg").hover(function(){ $(".pop_reg").show() },function(){ $(".pop_reg").hide()});
		 $('.closePop').click(function(){$('.pop_reg').hide();});
		 })