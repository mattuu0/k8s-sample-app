package main

import (
	"app/controller"
	"app/db"
	"app/model"
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Initialize Database
	db.Init()

	// Auto Migration
	if db.DB != nil {
		if err := db.DB.AutoMigrate(&model.Sample{}); err != nil {
			slog.Error("failed to migrate database", "error", err)
		}
	} else {
		slog.Warn("skipping auto migration: database connection is not established")
	}

	// Echo instance
	router := echo.New()

	// Middleware
	router.Use(middleware.Logger())
	router.Use(middleware.Recover())

	// Database Connection Check Middleware
	dbCheckMiddleware := func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if db.DB == nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": "database connection is not established"})
			}
			sqlDB, err := db.DB.DB()
			if err != nil || sqlDB.Ping() != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to connect to database"})
			}
			return next(c)
		}
	}

	// Initialize Controller
	sampleController := controller.SampleController{}

	// Routes
	router.GET("/", hello)
	router.GET("/hostname", sampleController.GetHostname)

	// Sample routes require DB
	sampleGroup := router.Group("/sample")
	sampleGroup.Use(dbCheckMiddleware)
	sampleGroup.GET("", sampleController.GetSample)
	sampleGroup.POST("", sampleController.PostSample)

	// Start server
	if err := router.Start(":8080"); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("failed to start server", "error", err)
	}
}

// Handler
func hello(ctx echo.Context) error {
	return ctx.String(http.StatusOK, "Hello, World!")
}
