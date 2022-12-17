const countDownDate = new Date(
  JSON.parse(atob(getCookie("token").split(".")[1]))["iat"] * 1000 + 300000
).getTime();

const x = setInterval(function () {
  const now = new Date().getTime();

  const distance = countDownDate - now;

  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  document.getElementById("timer").value =
    "Session Timer: " + minutes + "m " + seconds + "s ";

  if (distance < 0) {
    clearInterval(x);
    document.getElementById("timer").value = "Session Timer: Expired";
  }
}, 1000);
