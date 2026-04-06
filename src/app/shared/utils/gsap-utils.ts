import gsap from 'gsap';

export function fadeIn(el: any) {
  return gsap.from(el, {
    opacity: 0,
    y: 5,
    duration: 1
  });
}