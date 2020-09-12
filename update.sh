go build && \
mv compresstest-lambda compresstest && \
zip compresstest.zip compresstest && \
rm compresstest && \
aws lambda update-function-code --function-name compresstest --zip-file fileb://compresstest.zip && \
rm compresstest.zip
