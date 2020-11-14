var userId = window.location.href.match(/users\/(\d+)/)[1];
console.log("userId: " + userId);

async function getWorkout(limit){
    let response = await fetch("https://www.endomondo.com/rest/v1/users/" + userId + "/workouts/history?limit=" + limit + "&expand=workout%3Afull", {});
    return await response.json();
}

async function getWorkouts() {
    let workoutHistory = await getWorkout(1);
    let totalWorkouts = workoutHistory.paging.total;

    // TODO: change from 2 to total !
    totalWorkouts = 10;
    let response = await getWorkout(totalWorkouts);

    return response;
}

function getIDs(resp){
    if(resp.data){
        console.log("Got " + resp.data.length + " workouts !");
        return resp.data.map(workout => workout.id);
    }

    console.warn(" No Workouts Found!");
    window.alert(" No Workouts Found!");

    return [];
}

function exportGPX(workoutID){
//     console.log("export gpx for workout ID: " + workoutID);
    var gpxUrl = "https://www.endomondo.com/rest/v1/users/" + userId + "/workouts/" + workoutID + "/export?format=GPX";
    window.open(gpxUrl, "_blank");
}

function exportTCX(workoutID){
//     console.log("export tcx for workout ID: " + workoutID);
    var tcxUrl = "https://www.endomondo.com/rest/v1/users/" + userId + "/workouts/" + workoutID + "/export?format=TCX";
    window.open(tcxUrl, "_blank");
}

function paginateWorkouts(workoutIDs){
    var offset = 0;
    var pageSize = 4;
    var total = workoutIDs.length;

    console.log('set timer to get workouts');
    var myTimer = setInterval(function(){
        console.log('my timer');
        for (var index = offset; index < offset + pageSize && index < total; index++) {
            console.log('workout ID %d: %s', index + 1, workoutIDs[index]);
            exportGPX(workoutIDs(index));
        }
        offset += pageSize;
        if(offset >= total){
            console.log('clear timer to get workouts');
            clearInterval(myTimer);
        }
    }, 20000 );
}

function exportWorkouts(resp){
    console.log('get workouts IDs:');
    var workoutIDs = getIDs(resp);
    console.log(workoutIDs);

    paginateWorkouts(workoutIDs);
//     workoutIDs.forEach(workoutID => exportGPX(workoutID));
}

getWorkouts()
    .then(resp => exportWorkouts(resp))
    .catch(err => console.error("Endomondo Export Error!: " + err))