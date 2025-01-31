import { runLazadaPub } from "../lazada.producer";

runLazadaPub("LP1")
  .then(() => {
    console.log("run lp 1");
  })
  .catch((err) => {
    console.log(err);
  });
