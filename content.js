function getUserInfo(){
    let profileInfo = document.getElementsByClassName("header-member-profile-name")[0];
    let userId, userName;

    if(profileInfo){
        userId = profileInfo.href.split('/').pop();
        userName = profileInfo.innerText;
        // console.log('found profile info by method 1');
    } else {
        profileInfo = $(".headerRightContent").find("a[href*='profile']")[0];
        userId = profileInfo.href.split('/').pop();
        userName = profileInfo.innerText;
        // console.log('found profile info by method 2');
    }

    // chrome.runtime.sendMessage({action: "user_info", userId: userId, userName: userName});
    let userInfo = {};
    if(userId && userName){
        userInfo = {userId: userId, userName: userName};
    }

    console.debug("get user info from dom: ", userInfo);
    return userInfo;
}

(async function() {
    console.log("my extension: from content script!");
    let downloadInterval;
    // let userInfo = getUserInfo();
    let userInfo = {};
    let totalWorkout = "";

    /* Inject Code */
    // NOTE: not in used at the moment - ger user info from DOM.
    //
    // Inject get_user_info_script.js
    let s = document.createElement('script');
    //
    s.src = chrome.runtime.getURL('get_user_info_script.js');
    // s.onload = function() {
    //     this.remove();
    // };
    (document.head || document.documentElement).appendChild(s);

    async function getWorkout(limit, userId){
        if(!userId){
            console.warn("can't get workouts for userId: ", userId);
            return;
        }
        let response = await fetch("https://www.endomondo.com/rest/v1/users/" + userId + "/workouts/history?limit=" + limit + "&expand=workout%3Afull", {});
        return await response.json();
    }

    async function getWorkoutsRaw(totalWorkouts, userId) {
        // TODO: remove totalWorkouts hard coded line !
        totalWorkouts = 1;
        return await getWorkout(totalWorkouts, userId);
    }

    /**
     * Endomondo uses the start_time value as the file name, after the following format:
     *
     * strat_time: "2020-11-18T14:46:05.000Z"   =>   exported file name: 20201118_144605
     */
    function formatStartTime(start_time) {
        try {
            return start_time.split(".")[0].replace(/[-|:]/g, "").replace("T", "_")
        } catch (e) {
            console.error("failed to format start_time to a file name");
            return start_time;
        }
    }

    function getWorkoutsInfo(workoutsRaw){
        if(workoutsRaw.data){
            console.log("Got " + workoutsRaw.data.length + " workouts !");
            return workoutsRaw.data.map(workout => {
                return {"id": workout.id, "startTime": formatStartTime(workout.start_time)};
            });
        }
        return [];
    }

    async function getWorkoutXML(userId, workoutId, fileFormat){
        return await new Promise(resolve =>{
            let woURL = `https://www.endomondo.com/rest/v1/users/${userId}/workouts/${workoutId}/export?format=${fileFormat}`;
            let http = new XMLHttpRequest();

            http.open('GET', woURL, true);

            http.onreadystatechange = function() {//Call a function when the state changes.
                if(http.readyState === 4 && http.status === 200) {
                    let resp = http.responseText;
                    resolve(resp);
                }
            }

            http.send();
        })
    }

    /**
     *
     * @param workoutsInfo contains both workout id and workout start time
     * @param userId the user id
     * @param fileFormats
     *
     * Download every couple of seconds several workouts (not all at once).
     */
    function paginateWorkouts(workoutsInfo, userId, fileFormats=["TCX","GPX"]){
        let offset = 0;
        let pageSize = 4;
        let total = workoutsInfo.length;

        console.log('set timer to get workouts');
        downloadInterval = setInterval(function(){
            console.log('my timer');
            for (let index = offset; index < offset + pageSize && index < total; index++) {
                let workoutId = workoutsInfo[index].id;
                let startTime = workoutsInfo[index].startTime;

                for (let fileFormat of fileFormats){
                    // console.log('workout %d ID: %s (fileFormat: %s)', index + 1, workoutId, format);
                    getWorkoutXML(userId, workoutId, fileFormat).then(function(res){
                        console.log('workout %d ID: %s (format: %s) -> send XML to background to download', index + 1, workoutId, fileFormat);
                        chrome.runtime.sendMessage({action: "download_file", fileName: startTime, fileFormat: fileFormat , data: res});
                    });
                }
            }
            offset += pageSize;
            if(offset >= total){
                console.log('clear timer to get workouts');
                clearInterval(downloadInterval);
                downloadInterval = undefined;
            }
        }, 2000 );
    }

    async function getAllWorkouts(totalWorkouts, userId, fileFormats=["TCX","GPX"]){
        let wosRaw = await getWorkoutsRaw(totalWorkouts, userId);
        let wosInfo = getWorkoutsInfo(wosRaw);
        console.log("wosInfo: ", wosInfo);
        paginateWorkouts(wosInfo, userId, fileFormats);
    }

    async function updateTotalWorkouts(){
        let res = await getWorkout(1, userInfo.userId);
        if(res && res.paging){
            totalWorkout = res.paging.total;
            console.log("updateTotalWorkouts: ", res.paging.total);
        }
        return totalWorkout;
    }

    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        console.log("got action: ", request.action);

        if(request.action === "get_user_info_from_dom") {
            if (Object.keys(userInfo).length === 0) {
                userInfo = getUserInfo();
            }
            sendResponse(userInfo);
            chrome.runtime.sendMessage({action: "save_user_info", userInfo: userInfo});
            return true;
        }

        // if(request.action === "get_total_workouts_method_2"){
        //     if(!userInfo.userId){
        //         return;
        //     }
        //     if(totalWorkout) {
        //         sendResponse({totalWorkouts: totalWorkout});
        //         setTimeout(updateTotalWorkouts, 5000);
        //     } else {
        //         await updateTotalWorkouts();
        //         sendResponse({totalWorkouts: totalWorkout});
        //     }
        //     //
        //     // let res = await getWorkout(1, userInfo.userId);
        //     // if(res && res.paging){
        //     //     totalWorkout = res.paging.total;
        //     //     sendResponse({totalWorkouts: res.paging.total});
        //     //     console.log("res.paging.total: ", res.paging.total);
        //     // }
        //     return true;
        // }

        if(request.action === "get_total_workouts_number"){
            let res = await getWorkout(1, request.userId);
            if(res && res.paging){
                chrome.runtime.sendMessage({action: "total_workouts_response", data: res.paging.total});
            }
            return true;
        }

        // if(request.action === "fetch_all_workouts_xmls") {
        //     getAllWorkouts(request.totalWorkouts, request.userId);
        //     // TODO: make the btn disabled, until all workouts has been downloaded (the background would know).
        //     return true;
        // }
        //
        // if(request.action === "stop_fetch_all_workouts_xmls") {
        //     if(downloadInterval){
        //         clearInterval(downloadInterval);
        //         downloadInterval = undefined;
        //         //    TODO: send a message to popup to enable the download button again.
        //     }
        //     return true;
        // }

        // if(request.action === "stop_get_xmls_from_content") {
        //     if(downloadInterval){
        //         clearInterval(downloadInterval);
        //         downloadInterval = undefined;
        //         //    TODO: send a message to popup to enable the download button again.
        //     }
        //     return true;
        // }

        if(request.action === "get_xmls_from_content"){
            getAllWorkouts(request.totalWorkouts, request.userId, ["TCX", "GPX"]);

            // This is works, uncomment for download one file as an example:
            // res = await getWorkoutXML();
            // // TODO: entry point for scraping all workouts
            // //      add also startTime json to map IDs
            // chrome.runtime.sendMessage({action: "get_xmls_from_content_response", data: res});
            return true;
        }


        console.log(`No action was taken for request.action: "${request.action}"`);
    });

})();