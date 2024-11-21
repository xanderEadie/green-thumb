// Handlebars.registerHelper('increment', function(value) {
//     return parseInt(value) + 1;
// });

document.getElementById("close-alert").addEventListener("click", hideAlert);

function hideAlert()
{
    const alert = document.getElementById('alert').classList.add('hidden');
}
