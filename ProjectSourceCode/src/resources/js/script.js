document.getElementById('close-alert').addEventListener('click', hideAlert);
function hideAlert()
{
    console.log("hideAlert function called");
    const alert = document.getElementById('alert');
    alert.style.display = "none";
}
