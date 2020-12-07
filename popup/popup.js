console.log('I AM POP UP');

function setUserInfo(sessionInfo){
    console.debug("[setUserInfo]: sessionInfo: ", sessionInfo);
    $(".hello_message").attr("hidden", true);

    $(".user_full_name").attr("hidden", false)
        .html(`Hello ${sessionInfo.userName}`);
    $(".user_id").attr("hidden", false)
        .html(`(Endomondo user id: ${sessionInfo.userId})`);
    if(sessionInfo.totalWorkouts) {
        $(".total_number_missing").attr("hidden", true);
        $(".total_number").attr("hidden", false)
            .html(`Total Workouts Found: <b>${sessionInfo.totalWorkouts}</b>`);
        if(sessionInfo.totalWorkouts > 0) {
            $("#download_all").prop('disabled', false);
        }
    } else {
        $(".total_number_missing").attr("hidden", false)
            .html('Total workouts are being processed...');
    }
}

function clearUserInfo(){
    $(".hello_message").attr("hidden", false);
    $(".user_full_name").attr("hidden", true).html("");
    $(".user_id").attr("hidden", false).html("");
    $("#download_all").prop('disabled', true);
    $(".total_number").attr("hidden", true).html("");
    $(".total_number_missing").attr("hidden", false);
}


let endomondoRE = /^https:\/\/www\.endomondo/;

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    // Only on endomondo pages:
    if(endomondoRE.test(tabs[0].url)){
        chrome.tabs.sendMessage(tabs[0].id, {action: "get_session_info"}, response => {
            if (response && response.sessionInfo && response.sessionInfo.loggedIn){
                sessionInfo = response.sessionInfo;
                console.debug("[get_session_info]: got session info: ", sessionInfo);
                setUserInfo(sessionInfo);
            } else {
                clearUserInfo();
            }
        });
    }
})

/* Event Handlers */

$(document).on('click', '#download_all', (e) => {
    console.log("'Downloading all' was clicked");

    // get XMLS from content
    chrome.runtime.sendMessage({action: "start_download_workouts"}, response => {
        console.log("start_download_workouts response => ", response);
    })

    // send a download order to background
    console.log("'Downloading all' was clicked");
})