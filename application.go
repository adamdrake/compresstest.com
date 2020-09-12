package main

import (
	"compress/gzip"
	"context"
	"io/ioutil"

	"bytes"
	"compress/flate"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/dsnet/compress/bzip2"
)

const maxRequestBodySize int64 = 3 << 20

type compressResponse struct {
	OriginalSize int `json:"original_size"`
	GzipSize     int `json:"gzip_size"`
	BzipSize     int `json:"bzip_size"`
	DeflateSize  int `json:"deflate_size"`
}

func gzipWorker(data []byte, resp *compressResponse, wg *sync.WaitGroup) {
	defer wg.Done()

	var buf bytes.Buffer
	zw, err := gzip.NewWriterLevel(&buf, flate.BestCompression)
	_, err = zw.Write(data)
	zw.Close()
	if err != nil {
		log.Fatal(err)
	}

	resp.GzipSize = buf.Len()
}

func bzipWorker(data []byte, resp *compressResponse, wg *sync.WaitGroup) {
	defer wg.Done()

	var buf bytes.Buffer
	conf := bzip2.WriterConfig{Level: bzip2.BestCompression}
	zw, err := bzip2.NewWriter(&buf, &conf)
	_, err = zw.Write(data)
	zw.Close()
	if err != nil {
		log.Fatal(err)
	}
	resp.BzipSize = buf.Len()
}

func flateWorker(data []byte, resp *compressResponse, wg *sync.WaitGroup) {
	defer wg.Done()

	var buf bytes.Buffer
	zw, err := flate.NewWriter(&buf, flate.BestCompression)
	if err != nil {
		log.Fatal(err)
	}
	_, err = zw.Write(data)
	if err != nil {
		log.Fatal(err)
	}
	zw.Close()
	resp.DeflateSize = buf.Len()
}

func dataCompressor(request []byte) compressResponse {
	var wg sync.WaitGroup
	resp := compressResponse{OriginalSize: len(request)}
	wg.Add(1)
	go gzipWorker(request, &resp, &wg)
	wg.Add(1)
	go bzipWorker(request, &resp, &wg)
	wg.Add(1)
	go flateWorker(request, &resp, &wg)
	wg.Wait()

	return resp
}

func compressHandler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Let's create the response we'll eventually send, being sure to have CORS headers in place
	resp := events.APIGatewayProxyResponse{Headers: make(map[string]string)}
	resp.Headers["Access-Control-Allow-Origin"] = "*"

	r := http.Request{}
	r.Header = make(map[string][]string)
	for k, v := range request.Headers {
		if k == "content-type" || k == "Content-Type" {
			r.Header.Set(k, v)
		}
	}
	// NOTE: API Gateway is set up with */* as binary media type, so al APIGatewayProxyRequests will be base64 encoded
	body, err := base64.StdEncoding.DecodeString(request.Body)
	r.Body = ioutil.NopCloser(bytes.NewBuffer(body))
	if err != nil {
		resp.StatusCode = 403
		resp.Body = "Could not read request body"
		return resp, nil
	}

	err = r.ParseMultipartForm(maxRequestBodySize)
	if err != nil {
		resp.StatusCode = 403
		resp.Body = "could not parse form"
		return resp, nil
	}

	f, _, err := r.FormFile("fileUpload")
	var s []byte
	if err == nil {
		s, err = ioutil.ReadAll(f)
		if err != nil {
			resp.StatusCode = 403
			resp.Body = "Could not read file"
			return resp, nil
		}
	}
	textEntry := []byte(r.FormValue("textEntry"))

	if len(s) == 0 && len(textEntry) == 0 {
		resp.StatusCode = 400
		resp.Body = "textEntry and fileUpload are both empty"
		return resp, nil
	}

	if len(s) > 0 && len(textEntry) > 0 {
		resp.StatusCode = 422
		resp.Body = "textEntry and fileUpload both supplied, but only one is allowed"
		return resp, nil
	}

	compressResult := compressResponse{}
	if len(s) > 0 && len(textEntry) == 0 {
		compressResult = dataCompressor(s)
	}

	if len(s) == 0 && len(textEntry) > 0 {
		compressResult = dataCompressor(textEntry)
	}
	js, _ := json.Marshal(compressResult)
	resp.StatusCode = 200
	resp.IsBase64Encoded = false
	resp.Body = string(js)
	return resp, nil
}

func main() {
	lambda.Start(compressHandler)
}
