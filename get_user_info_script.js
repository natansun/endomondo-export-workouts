console.log("[Get User Info Script]");
console.log("[Get User Info Script] _endoConfig: ", window.endoConfig);
chrome.runtime.sendMessage("fpjoknjfpgjalfjhkhedgkfenbhfbkie",
    { action: "endoConfig",
              endoConfig : window.endoConfig });

//
// (async function() {
//
//     function sendMessagePromise(data) {
//         return new Promise((resolve, reject) => {
//             chrome.runtime.sendMessage("fpjoknjfpgjalfjhkhedgkfenbhfbkie", data, response => {
//                 if (response.success) {
//                     resolve(response.data);
//                 } else {
//                     reject('Error');
//                 }
//             });
//         });
//     }
//
//     sendMessagePromise({ action: "endoConfig", "endoConfig" : window.endoConfig }).then(function(res){
//         console.log(res);
//     });
// })();

//
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     switch (request.action) {
//         case "get_window":
//             console.log("[get-window] got action: ", request.action);
//             sendResponse({
//                 "endoWin": window.endoConfig
//             })
//             return;
//         default:
//             console.log('[get-window] Got non familiar action: ', request.action);
//     }
// })