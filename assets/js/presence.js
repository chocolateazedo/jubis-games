/* Jubis Games — heartbeat de presença.
 * Inclua este script num jogo (<script src="../../assets/js/presence.js"></script>)
 * e ele avisa o servidor, a cada poucos segundos, que tem alguém jogando.
 * A home mostra "🟢 N jogando" embaixo do cartão. */
(function () {
  try {
    var m = location.pathname.match(/games\/([^\/?#]+)/);
    if (!m) return;
    var slug = m[1];
    var id = sessionStorage.getItem('jubis-pres-id');
    if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('jubis-pres-id', id); }
    var qs = '?game=' + encodeURIComponent(slug) + '&id=' + encodeURIComponent(id);
    function ping() { try { fetch('../../presence.php' + qs, { cache: 'no-store' }).catch(function () {}); } catch (e) {} }
    ping();
    setInterval(ping, 8000);
    addEventListener('pagehide', function () {
      try { navigator.sendBeacon('../../presence.php' + qs + '&leave=1'); } catch (e) {}
    });
  } catch (e) {}
})();
