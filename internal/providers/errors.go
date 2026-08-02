package providers

import "errors"

var (
	errEmptyPrompt = errors.New("prompt is required")
	errEmptyDir    = errors.New("project folder is required")
)
