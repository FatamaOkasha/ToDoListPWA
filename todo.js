document.getElementById("notifyButton").addEventListener("click", function () {
  if ("Notification" in window) {
    Notification.requestPermission((status) => {
      console.log("Notification Permission Status", status);
    });

    document.getElementById("notifyButton").style.display = "none";
  }
});

const outputDiv = document.getElementById("output");

var idbApp = (function () {
  "use strict";

  var dbPromise = idb.open("toDoList", 2, function (upgradeDB) {
    if (upgradeDB.oldVersion < 2) {
      upgradeDB.createObjectStore("toDoList", { keyPath: "taskTitle" });
    }
  });

  function addTask(event) {
    event.preventDefault();

    let taskTitle = document.getElementById("taskTitle").value;
    let hours = document.getElementById("hours").value;
    let mins = document.getElementById("mins").value;
    let secs = document.getElementById("secs").value;
    let day = document.getElementById("day").value;
    let month = document.getElementById("month").value;
    let year = document.getElementById("year").value;

    const task = {
      taskTitle,
      day,
      mins,
      secs,
      month,
      hours,
      year,
      notified: "no",
    };

    const now = new Date();
    const taskDate = new Date(
      +task.year,
      +task.month,
      +task.day,
      +task.hours,
      +task.mins,
      +task.secs
    );

    dbPromise.then((db) => {
      const tx = db.transaction("toDoList", "readwrite");
      const store = tx.objectStore("toDoList");

      const request = store.add(task);

      request.request.onsuccess = () => {
        console.log("Task added successfully");
        handleUpdateTask();

        // Clear form fields after adding task
        document.getElementById("todoForm").reset();

        updateUI(task);

        // Compare dates and apply line-through if taskDate has passed
        if (taskDate < now) {
          displayLineThroughTask(task);
          console.log("Task deadline has passed.");
        }
      };

      request.request.onerror = (event) => {
        console.error("Error adding task:", event.target.error);
        tx.abort();
      };
    });
  }

  function updateUI(task) {
    
      const monthNames = [
        "January", "February", "March", "April", "May", 
        "June", "July", "August", "September", "October", 
        "November", "December"
      ];
    
      const monthName = monthNames[task.month];
    
      const taskElement = document.createElement("div");
      taskElement.innerHTML = `${task.taskTitle} - ${task.hours}:${task.mins}, ${monthName} ${task.day} ${task.year}  <button class="button-delete" 
        onclick='idbApp.handleDeleteTask()' data-task="${task.taskTitle}">&#x2715;</button> <hr> `;
      outputDiv.appendChild(taskElement);
    }
    
  

  function displayLineThroughTask(task) {
    for (let i = 0; i < outputDiv.childNodes.length; i++) {
      if (outputDiv.childNodes[i].textContent.includes(task.taskTitle)) {
        outputDiv.childNodes[i].style.textDecoration = "line-through";
        break;
      }
    }
  }

  function isStrikeThrough(task) {
    for (let i = 0; i < outputDiv.childNodes.length; i++) {
      if (outputDiv.childNodes[i].textContent.includes(task.taskTitle)) {
        return outputDiv.childNodes[i].style.textDecoration === "line-through";
      }
    }
    return false;
  }

  let intervalId;
  function handleUpdateTask() {
    if (intervalId) clearInterval(intervalId);

    dbPromise
      .then((db) => {
        const tx = db.transaction("toDoList", "readonly");
        const store = tx.objectStore("toDoList");

        let request = store.getAll();

        request.request.onsuccess = function (event) {
          const allTasksArray = event.target.result;

          intervalId = setInterval(() => {
            const now = new Date();

            allTasksArray.forEach((task) => {
              const taskDate = new Date(
                +task.year,
                +task.month,
                +task.day,
                +task.hours,
                +task.mins,
                +task.secs
              );

              if (
                taskDate <= now &&
                task.notified === "no" &&
                !isStrikeThrough(task)
              ) {
               

                console.log("taskDate.getTime()", taskDate.getTime());
                console.log("now.getTime()", now.getTime());

                console.log(`Notifying user about task: ${task.taskTitle}`);
                notifyUser(task);

                const updateTx = db.transaction("toDoList", "readwrite");
                const updateStore = updateTx.objectStore("toDoList");

                task.notified = "yes";
                const updateRequest = updateStore.put(task);

                updateRequest.request.onsuccess = function () {
                  console.log(`Task ${task.taskTitle} updated successfully.`);
                  displayLineThroughTask(task);
                };

                updateRequest.onerror = function (event) {
                  console.error("Failed to update task:", event.target.error);
                };
              }
            });
          }, 1000); 
        };

        request.request.onerror = function (event) {
          console.error("Failed to fetch tasks:", event.target.error);
        };
      })
      .catch((err) => {
        console.error("Error with dbPromise:", err);
      });
  }

  function notifyUser(task) {
    console.log(`Notification for task: ${task.taskTitle}`);
    if (Notification.permission == "granted") {
      navigator.serviceWorker.getRegistration().then((reg) => {
        const options = {
          body: `HEY! Your task ${task.taskTitle} is now overdue.`,
        };
        reg.showNotification("To Do List", options);
      });
    }
  }

  function handleDeleteTask() {
    let dataTask = event.target.getAttribute("data-task");

    console.log("Attempting to delete task:", dataTask);

    dbPromise
      .then((db) => {
        const tx = db.transaction("toDoList", "readwrite");
        const store = tx.objectStore("toDoList");

        let request = store.delete(dataTask);

        request.request.onsuccess = () => {
          console.log(`Task ${dataTask} has been deleted successfully`);

          for (let i = 0; i < outputDiv.childNodes.length; i++) {
            if (outputDiv.childNodes[i].textContent.includes(dataTask)) {
              outputDiv.removeChild(outputDiv.childNodes[i]);
              break;
            }
          }
        };

        request.request.onerror = (event) => {
          console.error("Delete request error:", event.target.error);
        };

        tx.oncomplete = () => {
          console.log("Transaction completed.");
        };

        tx.onerror = (event) => {
          console.error("Transaction error:", event.target.error);
        };
      })
      .catch((err) => {
        console.error("Error with dbPromise:", err);
      });
  }

  return {
    dbPromise: dbPromise,
    addTask: addTask,
    handleDeleteTask: handleDeleteTask,
    handleUpdateTask: handleUpdateTask,
    // getAllTasks: getAllTasks,
  };
})();

document
  .getElementById("addTaskButton")
  .addEventListener("click", idbApp.addTask);

document.addEventListener("DOMContentLoaded", function () {
  idbApp.handleUpdateTask();
});