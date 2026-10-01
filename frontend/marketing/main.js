const root = document.documentElement;
const cursor = document.querySelector('.cursor-dot');
const halo = document.querySelector('.cursor-halo');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reducedMotion && window.matchMedia('(pointer: fine)').matches && cursor && halo) {
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let haloX = targetX;
  let haloY = targetY;
  window.addEventListener('pointermove', (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    cursor.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
  });
  const animateCursor = () => {
    haloX += (targetX - haloX) * 0.18;
    haloY += (targetY - haloY) * 0.18;
    halo.style.transform = `translate3d(${haloX}px, ${haloY}px, 0)`;
    requestAnimationFrame(animateCursor);
  };
  animateCursor();
  document.querySelectorAll('a, button').forEach((element) => {
    element.addEventListener('pointerenter', () => root.classList.add('cursor-active'));
    element.addEventListener('pointerleave', () => root.classList.remove('cursor-active'));
  });
}

const revealItems = document.querySelectorAll('[data-reveal]');
if (!reducedMotion && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}
