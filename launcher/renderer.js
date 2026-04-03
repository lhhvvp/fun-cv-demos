const cardsContainer = document.getElementById('cards');
const searchInput = document.getElementById('search');

function renderCards(apps) {
  if (!cardsContainer) return;
  cardsContainer.innerHTML = '';

  apps.forEach((app) => {
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.dataset.slug = app.slug;

    const thumb = document.createElement('div');
    thumb.className = 'card-thumb';

    const image = document.createElement('img');
    if (app.thumbnailPath) {
      image.src = app.thumbnailPath;
    } else {
      image.classList.add('placeholder');
    }
    image.alt = `${app.title} preview`;
    image.loading = 'eager';
    thumb.appendChild(image);

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h2');
    title.textContent = app.title;

    const description = document.createElement('p');
    description.textContent = app.description;

    body.appendChild(title);
    body.appendChild(description);

    card.appendChild(thumb);
    card.appendChild(body);

    card.addEventListener('click', () => window.launcherAPI.openApp(app.slug));
    cardsContainer.appendChild(card);
  });
}

function setupSearch(apps) {
  if (!searchInput) return;

  searchInput.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    if (!query) {
      renderCards(apps);
      return;
    }

    const filtered = apps.filter(
      (app) =>
        app.title.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query) ||
        app.slug.toLowerCase().includes(query)
    );
    renderCards(filtered);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const apps = await window.launcherAPI.getApps();
    renderCards(apps);
    setupSearch(apps);
  } catch (error) {
    console.error('Failed to load apps', error);
    if (cardsContainer) {
      cardsContainer.innerHTML =
        '<p class="error">Something went wrong while loading the launcher.</p>';
    }
  }
});
