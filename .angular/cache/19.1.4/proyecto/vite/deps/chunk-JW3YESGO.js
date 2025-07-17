import {
  createAnimation,
  getIonPageElement
} from "./chunk-X3VSVWA6.js";

// node_modules/@ionic/core/dist/esm-es5/md.transition-8dc58b46.js
var mdTransitionAnimation = function(a, i) {
  var e, n, t;
  var r = "40px";
  var o = "0px";
  var m = i.direction === "back";
  var c = i.enteringEl;
  var s = i.leavingEl;
  var l = getIonPageElement(c);
  var v = l.querySelector("ion-toolbar");
  var b = createAnimation();
  b.addElement(l).fill("both").beforeRemoveClass("ion-page-invisible");
  if (m) {
    b.duration(((e = i.duration) !== null && e !== void 0 ? e : 0) || 200).easing("cubic-bezier(0.47,0,0.745,0.715)");
  } else {
    b.duration(((n = i.duration) !== null && n !== void 0 ? n : 0) || 280).easing("cubic-bezier(0.36,0.66,0.04,1)").fromTo("transform", "translateY(".concat(r, ")"), "translateY(".concat(o, ")")).fromTo("opacity", 0.01, 1);
  }
  if (v) {
    var p = createAnimation();
    p.addElement(v);
    b.addAnimation(p);
  }
  if (s && m) {
    b.duration(((t = i.duration) !== null && t !== void 0 ? t : 0) || 200).easing("cubic-bezier(0.47,0,0.745,0.715)");
    var d = createAnimation();
    d.addElement(getIonPageElement(s)).onFinish(function(a2) {
      if (a2 === 1 && d.elements.length > 0) {
        d.elements[0].style.setProperty("display", "none");
      }
    }).fromTo("transform", "translateY(".concat(o, ")"), "translateY(".concat(r, ")")).fromTo("opacity", 1, 0);
    b.addAnimation(d);
  }
  return b;
};

export {
  mdTransitionAnimation
};
/*! Bundled license information:

@ionic/core/dist/esm-es5/md.transition-8dc58b46.js:
  (*!
   * (C) Ionic http://ionicframework.com - MIT License
   *)
*/
//# sourceMappingURL=chunk-JW3YESGO.js.map
