// apiUtils.ts

export function sendRequestToServer(email) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ email });
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;

        xhr.addEventListener("readystatechange", function () {
            if (this.readyState === 4) {
                const result = JSON.parse(this.responseText);
                resolve(result);
            }
        });

        xhr.open("POST", `http://${localStorage.getItem('server_socket')}/check_email_and_generate_otp`);
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.onerror = function () {
            reject('An error occurred during the transaction');
        };

        xhr.send(data);
    });
}
// https://ojas.oneable.ai/api//v1/show/page