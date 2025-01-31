import { runTokopediaPub } from "../tokopedia.producer";

runTokopediaPub("TP1")
  .then(() => {
    console.log("run tp 1");
  })
  .catch((err) => {
    console.log(err);
  });
