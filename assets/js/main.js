(() => {
  'use strict';

  const buttons = document.querySelectorAll('.world-btn');
  const cards = document.querySelectorAll('.game-tile');

  function filterWorld(world) {
    cards.forEach((card) => {
      const match = world === 'Todos' || card.dataset.world === world;
      card.hidden = !match;
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      filterWorld(btn.dataset.world);
    });
  });

  const heroImage = document.getElementById('heroImage');
  if (heroImage) {
    heroImage.addEventListener('error', () => {
      heroImage.src = 'https://images.openai.com/blob/2ca166e5-d4cc-4855-ae66-a0b3e18ed420?download=1';
    }, { once: true });
  }
})();
