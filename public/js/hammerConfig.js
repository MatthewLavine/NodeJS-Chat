  var swipeleft = Hammer(document.body).on("swiperight", function(ev) {
    $(".off-canvas-wrap").addClass("move-right");
  });

  var swiperight = Hammer(document.body).on("swipeleft", function(ev) {
    $(".off-canvas-wrap").addClass("move-left");
  });
  