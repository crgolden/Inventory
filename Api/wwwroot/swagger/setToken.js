if (!window.isOpenReplaced) {
    window.open = function (open) {
        return function (url) {
            url = url.replace('response_type=token', 'response_type=token id_token');
            return open.call(window, url);
        };
    }(window.open);
    window.isOpenReplaced = true;
}
