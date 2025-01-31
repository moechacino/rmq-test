import { runShopeePub } from "../shopee.producer";

runShopeePub("SP1")
  .then(() => {
    console.log("run sp 1");
  })
  .catch((err) => {
    console.log(err);
  });
