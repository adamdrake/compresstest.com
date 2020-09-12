function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function wholePercentChange(a, b) {
    let percent = Math.floor(((a - b) / a) * 100);
    if (percent <= 0) {
        return Math.abs(percent) + 100;
    } else
        return 100 - percent;
}

function findLargest() {
    let vals = Array.from(arguments);
    return Math.max(...vals);
}

function reset() {
    $('.alertText').hide();
    $('.alertFile').hide();
    $('#sizeOriginal').empty();
    $('#gzip').empty();
    $('#bzip').empty();
    $('#deflate').empty();
    $('.intro').slideDown(500);
}

function bytesToHumanReadable(b) {
    let kb = 1024;
    let mb = 1024 * kb;
    let gb = 1024 * mb;
    if (b > gb) {
        return (b / gb).toFixed(2) + ' GB'
    }
    if (b > mb) {
        return (b / mb).toFixed(2) + ' MB'
    }
    if (b > kb) {
        return (b / kb).toFixed(2) + ' KB'
    }
    return b + ' bytes'
}

function populateResults(original_size, gzip_size, bzip_size, deflate_size) {
    $('#sizeOriginal').html(bytesToHumanReadable(original_size));
    $('#gzip').html(bytesToHumanReadable(gzip_size));
    $('#bzip').html(bytesToHumanReadable(bzip_size));
    $('#deflate').html(bytesToHumanReadable(deflate_size));
}

function populatePercentBars(original_size, gzip_size, bzip_size, deflate_size) {
    let max = findLargest(original_size, gzip_size, bzip_size, deflate_size);
    let factor = 100 / max;

    let orig_bar = document.getElementById('is-original');
    let p = original_size * factor;
    orig_bar.style.width = p + '%';

    let gzip_bar = document.getElementById('is-gzip');
    gzip_bar.style.width = gzip_size * factor + '%';
    $('#gzip-percent').html(wholePercentChange(original_size, gzip_size) + '% ');

    let bzip_bar = document.getElementById('is-bzip');
    bzip_bar.style.width = bzip_size * factor + '%';
    $('#bzip-percent').html(wholePercentChange(original_size, bzip_size) + '% ');

    let deflate_bar = document.getElementById('is-deflate');
    deflate_bar.style.width = deflate_size * factor + '%';
    $('#deflate-percent').html(wholePercentChange(original_size, deflate_size) + '% ');
}

function send(formData) {
    // Request results
    let apiURL = 'https://api.compresstest.com';

    $.ajax({
        url: apiURL,
        data: formData,
        cache: false,
        processData: false,
        method: 'POST',
        contentType: false,
        success: function (data) {

            // Parse data and pass to formatResults
            let original_size = data.original_size;
            let gzip_size = data.gzip_size;
            let bzip_size = data.bzip_size;
            let deflate_size = data.deflate_size;
            populateResults(original_size, gzip_size, bzip_size, deflate_size);
            populatePercentBars(original_size, gzip_size, bzip_size, deflate_size);

            $('.intro').slideUp(500);
            $('#submitTextButton').html('Test it!');
            $('#submitFileButton').html('Test it!');
        }

    });
}

$(document).ready(function () {
    $('.alertText').hide();
    $('.alertFile').hide();
    $('#textEntry').focus();

    // Submit a text block
    $('#submitText').on('click', function (e) {
        e.preventDefault();

        let text = document.querySelector('#textEntry').value;

        // Catch empty input
        if (text.length === 0) {
            $('.alertText').show();
            $('#alertText').html('Try typing something in the box above first.')
        } else {

            // Show loading indicator
            $('#submitTextButton').html('Fetching...');
            let formData = new FormData(textForm);
            send(formData);

        }
    });

    // Submit a file
    $('#submitFile').on('click', function (e) {
        e.preventDefault();

        let file = document.querySelector('#fileUpload').value,
            input = document.getElementById('fileUpload'),
            inputFile = input.files[0];

        if (file === '') {
            // Empty file input
            $('.alertFile').show();
            $('#alertFile').html('Try uploading a file first.');
        } else {
            if (inputFile.size >= 3000000) {
                // Stop files over limit
                $('.alertFile').show();
                $('#alertFile').html('Your file is too large. It\'s ' + (inputFile.size / 1000000).toFixed(1) + ' MB.')
            } else if (inputFile.size < 3000000) {
                // File OK, show loading indicator
                $('#submitFileButton').html('Fetching...');
                let formData = new FormData(fileForm);
                send(formData);
            }
        }

    });

    // Reset button
    $('#reset').on('click', async function refresh(e) {
        e.preventDefault();
        $('.alertText').hide();
        $('.alertFile').hide();
        let target = $('#top');
        $('html, body').animate({
            scrollTop: target.offset().top
        }, 500);
        await sleep(500);
        reset();
    })

});
