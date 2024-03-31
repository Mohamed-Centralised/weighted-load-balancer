import express from "express";
import httpProxy from "http-proxy-middleware";
import axios from "axios";
import { createObjectCsvWriter } from "csv-writer";

const serverConfigurations = [
  { port: 5073, weight: 2 },
  { port: 5173, weight: 1 },
  { port: 5273, weight: 2 },
  { port: 5373, weight: 1 },
  { port: 5473, weight: 2 },
  { port: 5573, weight: 1 },
  { port: 5673, weight: 2 },
  { port: 5773, weight: 1 },
  { port: 5873, weight: 2 },
  { port: 5973, weight: 1 },
];
const app = express();
const port = 8000;

const csvWriter = createObjectCsvWriter({
  path: "request_logs.csv",
  header: [
    { id: "timestamp", title: "Timestamp" },
    { id: "ip", title: "IP Address" },
    { id: "serverPort", title: "Server Port" },
    { id: "originalUrl", title: "Original URL" },
  ],
});

app.use((req, res, next) => {
  const selectedServer = selectServer(serverConfigurations);
  req.selectedServer = selectedServer;

    const logData = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    serverPort: selectedServer ? selectedServer.port : "N/A",
    originalUrl: req.originalUrl,
  };
  csvWriter.writeRecords([logData]);
  if (selectedServer) {
    proxyRequest(req, res);
  } else {
    res.status(503).send("Service Unavailable");
  }
});

const selectedServerProxy = httpProxy.createProxyMiddleware({
  target: "<http://localhost>",
  changeOrigin: true,
});

app.use("/", selectedServerProxy);
app.listen(port, () => {
  console.log(`Load Balancer listening at <http://localhost>:${port}`);
});

function selectServer(serverConfigurations) {
  let currentWeightIndex = 0;
  while (true) {
    const totalWeight = serverConfigurations.reduce(
      (acc, config) => acc + config.weight,
      0
    );
    const randomNum = Math.floor(Math.random() * totalWeight);
    let weightSum = 0;
    for (let i = currentWeightIndex; i < serverConfigurations.length; i++) {
      const config = serverConfigurations[i];
      weightSum += config.weight;
      if (randomNum < weightSum) {
        currentWeightIndex = (i + 1) % serverConfigurations.length;
        return config;
      }
    }
    currentWeightIndex = 0;
  }
}

function proxyRequest(req, res) {
  const selectedServer = req.selectedServer;
  const selectedPort = selectedServer.port;
  const originalUrl = req.originalUrl; 
  axios
    .get(`http://localhost:${selectedPort}${originalUrl}`)
    .then((serverResponse) => {
      const responseData = serverResponse.data;
      res.send(responseData);
    })
    .catch((error) => {
      console.error(`Error forwarding request to server: ${error}`);
      res.status(500).send("Internal Server Error");
    });
}
