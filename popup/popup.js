console.log('I AM POP UP');

function setUserInfo(data){
    $(".hello_message").attr("hidden", true);

    $(".user_full_name").attr("hidden", false)
        .html(`Hello ${data.firstName} ${data.lastName}`);
    $(".user_id").attr("hidden", false)
        .html(`(Endomondo user id: ${data.userId})`);
    // if(data.downloadInProgress){
    //     $("#stop_download").attr('hidden', false)
    //         .prop('disabled', false);
    // }
}

function clearUserInfo(){
    $(".hello_message").attr("hidden", false);
    $(".user_full_name").attr("hidden", true).html("");
    $(".user_id").attr("hidden", false).html("");
    $("#download_all").prop('disabled', true);
    $(".total_number").attr("hidden", true).html("");
}


let endomondoRE = /^https:\/\/www\.endomondo/;

chrome.tabs.query({active: true, currentWindow: true}, (tabs) =>{

    // Only on endomondo pages:
    if(endomondoRE.test(tabs[0].url)){

        chrome.tabs.sendMessage(tabs[0].id, {action: "message from pop-up to content !"});

        chrome.tabs.sendMessage(tabs[0].id, {action: "get_user_info_from_dom"}, response => {
            setUserInfo({firstName: response.userName,
                              lastName: "",
                              userId: response.userId
            });
        });

        // chrome.tabs.sendMessage(tabs[0].id, {action: "get_total_workouts_method_2"});

        let port = chrome.extension.connect({
            name: "Sample Communication"
        });
        // port.postMessage({action: "get_user_info"});
        port.postMessage({action: "get_total_workouts"});

        port.postMessage({action: "get_total_workouts_method_2"});

        port.onMessage.addListener(function(data) {
            if(data.action === "set_user_info"){
                setUserInfo(data);
            }
            if(data.action === "user_logged_out"){
                clearUserInfo();
            }
            if(data.action === "set_total_workouts"){
                if(data.total_workouts) {
                    $(".total_number").attr("hidden", false)
                        .html(`Total Workouts Found: <b>${data.total_workouts}</b>`);
                    if(data.total_workouts > 0) {
                        $("#download_all").prop('disabled', false);
                    }
                }
            }
            if(data.action === "set_total_workouts_method_2"){
                if(data.total_workouts) {
                    $(".total_number").attr("hidden", false)
                        .html(`Total Workouts Found: <b>${data.totalWorkouts}</b>`);
                    if(data.total_workouts > 0) {
                        $("#download_all").prop('disabled', false);
                    }
                }
            }
        });

    }
})

/* Event Handlers */

$(document).on('click', '#stop_download', (e) => {
    chrome.runtime.sendMessage({action: "stop_get_xmls_from_bg"}, response => {
        console.log("stop_get_xmls_from_bg response => ", response);
    })

});

$(document).on('click', '#download_all', (e) => {
    console.log("'Downloading all' was clicked");



    // $("#stop_download").attr('hidden', false)
    //     .prop('disabled', false);

    // get XMLS from content
    chrome.runtime.sendMessage({action: "get_xmls_from_bg"}, response => {
        console.log("get_xmls_from_bg response => ", response);
    })

    // send a download order to background
    console.log("'Downloading all' was clicked");
})