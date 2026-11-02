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

    function isInfoHash(h) {
        return typeof h === 'string' && (/^[a-f0-9]{40}$/i.test(h) || /^[a-z2-7]{32}$/i.test(h));
    }

    // Достаём magnet или ссылку на .torrent из объекта раздачи
    function getLink(item) {
        if (!item) return '';

        var magnet = item.MagnetUri || item.magnet || item.Magnet || '';
        if (/^magnet:/i.test(magnet)) return magnet;

        var link = item.Link || item.link || item.url || '';
        if (/^magnet:/i.test(link)) return link;

        // В ссылке может быть зашит btih
        var m = link.match(/btih[:=]([a-z0-9]{32,40})/i);
        if (m && isInfoHash(m[1])) return 'magnet:?xt=urn:btih:' + m[1];

        // Настоящий infohash (не путать с внутренним hash Лампы от названия)
        var hash = item.InfoHash || item.infohash || item.info_hash;
        if (isInfoHash(hash)) {
            var title = item.Title || item.title || '';
            return 'magnet:?xt=urn:btih:' + hash + (title ? '&dn=' + encodeURIComponent(title) : '');
        }

        return link; // прямая ссылка на .torrent-файл
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
        //    (так же делает сама Лампа для magnet и .torrent-ссылок)
        try {
            if (window.AndroidJS && typeof window.AndroidJS.openTorrentLink === 'function') {
                window.AndroidJS.openTorrentLink(link, JSON.stringify({}));
                return;
            }
        } catch (e) {}

        // 2) Нет моста Android — не уходим со страницы (иначе Лампа «ломается»),
        //    а копируем ссылку
        copy(link);
        notify('Открыть не получилось — ссылка скопирована, вставьте её в торрент-клиент');
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
            title: 'Копировать ссылку на торрент',
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
