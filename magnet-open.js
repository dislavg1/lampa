/*
 * Lampa plugin: "Открыть в торрент-клиенте"
 * Добавляет в меню долгого нажатия на раздачу пункты:
 *   - Открыть в торрент-клиенте (Android «Открыть с помощью…»)
 *   - Копировать magnet-ссылку
 */
(function () {
    'use strict';

    if (window.magnet_open_plugin_ready) return;
    window.magnet_open_plugin_ready = true;

    function notify(text) {
        try { Lampa.Noty.show(text); } catch (e) { console.log('[magnet-open]', text); }
    }

    // Достаём magnet или ссылку на .torrent из объекта раздачи
    function getLink(item) {
        if (!item) return '';
        var magnet = item.MagnetUri || item.magnet || item.Magnet || '';
        if (magnet) return magnet;

        var link = item.Link || item.link || item.url || '';
        if (/^magnet:/i.test(link)) return link;

        var hash = item.hash || item.InfoHash || item.infohash || item.Hash;
        if (hash) {
            var title = item.Title || item.title || '';
            return 'magnet:?xt=urn:btih:' + hash + (title ? '&dn=' + encodeURIComponent(title) : '');
        }
        return link; // прямая ссылка на .torrent
    }

    function copy(text) {
        try {
            if (Lampa.Utils && Lampa.Utils.copyTextToClipboard) {
                Lampa.Utils.copyTextToClipboard(text, function () {
                    notify('Ссылка скопирована');
                }, function () {
                    notify('Не удалось скопировать');
                });
                return;
            }
        } catch (e) {}
        try {
            navigator.clipboard.writeText(text).then(function () {
                notify('Ссылка скопирована');
            });
        } catch (e) {
            notify('Не удалось скопировать');
        }
    }

    function openExternal(link) {
        if (!link) return notify('У раздачи нет ссылки');

        // 1) Android-приложение Lampa: передаёт ссылку системе через intent
        try {
            if (Lampa.Platform && Lampa.Platform.is('android') &&
                Lampa.Android && typeof Lampa.Android.openTorrentLink === 'function') {
                Lampa.Android.openTorrentLink(link, JSON.stringify({}));
                return;
            }
        } catch (e) {}

        // 2) Запасной вариант: открыть ссылку напрямую
        try {
            var w = window.open(link, '_blank');
            if (!w) window.location.href = link;
        } catch (e) {
            copy(link);
            notify('Не удалось открыть — ссылка скопирована, вставьте её в клиент');
        }
    }

    function addMenu(e) {
        if (!e || e.type !== 'onlong' || !e.menu) return;

        var item = e.element || e.item || e.data;
        var link = getLink(item);

        e.menu.push({
            title: 'Открыть в торрент-клиенте',
            magnet_open: true,
            onSelect: function () { openExternal(link); }
        });
        e.menu.push({
            title: 'Копировать magnet-ссылку',
            magnet_copy: true,
            onSelect: function () { link ? copy(link) : notify('У раздачи нет ссылки'); }
        });
    }

    // Некоторые версии Select вызывают общий onSelect, а не onSelect пункта —
    // подстрахуемся и перехватим выбор наших пунктов.
    function patchSelect() {
        if (!Lampa.Select || Lampa.Select.__magnet_patched) return;
        var original = Lampa.Select.show;
        Lampa.Select.show = function (params) {
            if (params && params.items && params.onSelect) {
                var orig = params.onSelect;
                params.onSelect = function (a) {
                    if (a && (a.magnet_open || a.magnet_copy) && typeof a.onSelect === 'function') {
                        a.onSelect();
                        try { Lampa.Controller.toggle('content'); } catch (e) {}
                        return;
                    }
                    return orig.apply(this, arguments);
                };
            }
            return original.apply(this, arguments);
        };
        Lampa.Select.__magnet_patched = true;
    }

    function start() {
        patchSelect();
        Lampa.Listener.follow('torrent', addMenu);
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
})();
