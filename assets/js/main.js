// Jubis Games — interações leves
(function () {
  'use strict';

  // Sufixo de ano no rodapé (defensive — em PHP já é renderizado, mas mantemos como fallback).
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // "Insere moeda" no clique do logo: pequeno efeito de feedback.
  var logo = document.querySelector('.logo__icon');
  if (logo) {
    logo.addEventListener('click', function () {
      logo.animate(
        [
          { transform: 'rotate(0deg) scale(1)' },
          { transform: 'rotate(-15deg) scale(1.15)' },
          { transform: 'rotate(0deg) scale(1)' }
        ],
        { duration: 450, easing: 'cubic-bezier(.4,1.7,.4,1)' }
      );
    });
  }

  // Quando o usuário entra no catálogo via #jogos, dá um leve highlight nos cards.
  var grid = document.querySelector('.games__grid');
  if (grid && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, i) {
        if (e.isIntersecting) {
          e.target.style.opacity = '0';
          e.target.style.transform = 'translateY(20px)';
          requestAnimationFrame(function () {
            e.target.style.transition = 'opacity .5s ease ' + (i * 60) + 'ms, transform .5s ease ' + (i * 60) + 'ms';
            e.target.style.opacity = '1';
            e.target.style.transform = 'translateY(0)';
          });
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    Array.prototype.forEach.call(grid.children, function (card) {
      io.observe(card);
    });
  }

  // Atalhos de teclado divertidos (Konami simplificado: setas + Enter para destacar o catálogo).
  var seq = [];
  var target = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','Enter'];
  document.addEventListener('keydown', function (ev) {
    seq.push(ev.key);
    if (seq.length > target.length) seq.shift();
    if (seq.join() === target.join()) {
      document.documentElement.animate(
        [{ filter: 'hue-rotate(0deg)' }, { filter: 'hue-rotate(360deg)' }],
        { duration: 1500 }
      );
      seq = [];
    }
  });
})();
