document.addEventListener("DOMContentLoaded", async () => {
  // Load data from storage
  const { domainData } = await chrome.storage.local.get("domainData");

  // Initialize Chart.js
  let timeChart = null;

  // Tab switching
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      updateDisplay(domainData || {}, tab.dataset.range);
    });
  });

  // Initial display
  updateDisplay(domainData || {}, "today");

  // Update display when data changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.domainData) {
      updateDisplay(
        changes.domainData.newValue || {},
        document.querySelector(".tab.active").dataset.range
      );
    }
  });
});

function updateDisplay(domainData, range) {
  let filteredData = {};
  const now = new Date();

  if (range === "today") {
    const today = now.toISOString().split("T")[0];
    filteredData = domainData[today] || {};
  } else if (range === "week") {
    // Get data for the last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      if (domainData[dateStr]) {
        Object.entries(domainData[dateStr]).forEach(([domain, time]) => {
          filteredData[domain] = (filteredData[domain] || 0) + time;
        });
      }
    }
  } else {
    // all time
    Object.values(domainData).forEach((dayData) => {
      Object.entries(dayData).forEach(([domain, time]) => {
        filteredData[domain] = (filteredData[domain] || 0) + time;
      });
    });
  }

  // Calculate total time
  const totalSeconds = Object.values(filteredData).reduce(
    (sum, time) => sum + time,
    0
  );
  updateTotalTime(totalSeconds);

  // Find top site
  updateTopSite(filteredData);

  // Display domain list
  displayDomainList(filteredData);

  // Update chart
  updateTimeChart(filteredData);
}

function updateTotalTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  let timeString = "";
  if (hours > 0) timeString += `${hours}h `;
  if (minutes > 0 || hours > 0) timeString += `${minutes}m `;
  timeString += `${seconds}s`;

  document.getElementById("total-time").textContent = timeString.trim();
}

function updateTopSite(data) {
  let topSite = "-";
  let maxTime = 0;

  Object.entries(data).forEach(([domain, time]) => {
    if (time > maxTime) {
      maxTime = time;
      topSite = domain;
    }
  });

  document.getElementById("top-site").textContent = topSite;
}

function displayDomainList(data) {
  const domainList = document.getElementById("domain-list");

  // Clear existing items (except header)
  const header = domainList.querySelector(".domain-list-header");
  domainList.innerHTML = "";
  if (header) domainList.appendChild(header);

  // Sort domains by time (descending)
  const sortedDomains = Object.entries(data).sort((a, b) => b[1] - a[1]);

  // Add domain items
  if (sortedDomains.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "empty-message";
    emptyMsg.textContent = "No browsing data available";
    domainList.appendChild(emptyMsg);
    return;
  }

  sortedDomains.forEach(([domain, time]) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    let timeString = "";
    if (hours > 0) timeString += `${hours}h `;
    if (minutes > 0 || hours > 0) timeString += `${minutes}m `;
    timeString += `${seconds}s`;

    const item = document.createElement("div");
    item.className = "domain-item";
    item.innerHTML = `
      <span class="domain-name" title="${domain}">${domain}</span>
      <span class="time-spent">${timeString.trim()}</span>
    `;
    domainList.appendChild(item);
  });
}

function updateTimeChart(data) {
  const ctx = document.getElementById("timeChart").getContext("2d");

  // Destroy previous chart if it exists
  if (window.timeChart) {
    window.timeChart.destroy();
  }

  // Prepare chart data (top 10 sites)
  const sortedData = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const labels = sortedData.map(([domain]) => domain);
  const timeData = sortedData.map(([_, time]) => Math.floor(time / 60)); // Convert to minutes

  window.timeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Minutes spent",
          data: timeData,
          backgroundColor: "rgba(66, 133, 244, 0.7)",
          borderColor: "rgba(66, 133, 244, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Minutes",
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const minutes = context.raw;
              const hours = Math.floor(minutes / 60);
              const remainingMinutes = minutes % 60;
              return hours > 0
                ? `${hours}h ${remainingMinutes}m`
                : `${minutes}m`;
            },
          },
        },
      },
    },
  });
}
