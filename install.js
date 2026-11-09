const installButton = document.getElementById('install');
const installHelp = document.getElementById('install-help');
const standalone = window.matchMedia('(display-mode: standalone)');
let installPrompt;

function updateInstallButton() {
  installButton.hidden = standalone.matches || navigator.standalone === true;
}

updateInstallButton();
standalone.addEventListener?.('change', updateInstallButton);
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  installButton.hidden = true;
});
installButton.addEventListener('click', async () => {
  if (!installPrompt) return installHelp.showModal();
  const prompt = installPrompt;
  installPrompt = undefined;
  try {
    await prompt.prompt();
  } catch {
    installHelp.showModal();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('Okey çevrimdışı kullanım için hazırlanamadı.', error);
  });
}
