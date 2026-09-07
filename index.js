const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* =========================================================
   PORT
========================================================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 /api/youtube`);
  console.log(`👁️ /api/visitors`);
});

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());
app.use(express.json());

/* =========================================================
   MYSQL CONNECTION - RAILWAY
========================================================= */

const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  port: Number(process.env.MYSQLPORT),
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
});

db.connect((err) => {
  if (err) {
    console.log("❌ MySQL connection failed:");
    console.log(err.message);
    return;
  }

  console.log("✅ MySQL connected!");
});

/* =========================================================
   TEST ROUTE
========================================================= */

app.get("/", (req, res) => {
  res.send("MO3Z Express Server Running! 🔥");
});

/* =========================================================
   UNIQUE WEBSITE VISITOR
========================================================= */

app.post("/api/visitors", (req, res) => {
  const { visitorId } = req.body;

  if (!visitorId) {
    return res.status(400).json({
      success: false,
      message: "visitorId is required",
    });
  }

  const insertSql = `
    INSERT IGNORE INTO visitors (visitor_id)
    VALUES (?)
  `;

  db.query(insertSql, [visitorId], (err) => {
    if (err) {
      console.log("❌ Visitor insert error:");
      console.log(err.message);

      return res.status(500).json({
        success: false,
        message: "Could not save visitor",
      });
    }

    const countSql = `
      SELECT COUNT(*) AS views
      FROM visitors
    `;

    db.query(countSql, (err, result) => {
      if (err) {
        console.log("❌ Visitor count error:");
        console.log(err.message);

        return res.status(500).json({
          success: false,
          message: "Could not get visitor count",
        });
      }

      res.json({
        success: true,
        views: result[0].views,
      });
    });
  });
});

/* =========================================================
   GET TOTAL UNIQUE VISITORS
========================================================= */

app.get("/api/visitors", (req, res) => {
  const sql = `
    SELECT COUNT(*) AS views
    FROM visitors
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.log("❌ Visitor count error:");
      console.log(err.message);

      return res.status(500).json({
        success: false,
        message: "Could not get visitor count",
      });
    }

    res.json({
      success: true,
      views: result[0].views,
    });
  });
});

/* =========================================================
   LIVE YOUTUBE DATA
========================================================= */

app.get("/api/youtube", async (req, res) => {
  try {
    /* =====================================================
       YOUTUBE API KEY
    ===================================================== */

    const API_KEY = process.env.YOUTUBE_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "YOUTUBE_API_KEY is missing in Railway Variables",
      });
    }

    /* =====================================================
       1. GET CHANNEL
    ===================================================== */

    const channelUrl =
      `https://www.googleapis.com/youtube/v3/channels` +
      `?part=snippet,contentDetails,statistics` +
      `&forHandle=@mo3z_roblox` +
      `&key=${API_KEY}`;

    const channelResponse = await fetch(channelUrl);

    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();

      console.log("❌ YouTube channel API error:");
      console.log(errorText);

      return res.status(500).json({
        success: false,
        message: "YouTube channel API failed",
      });
    }

    const channelData = await channelResponse.json();

    /* =====================================================
       CHECK CHANNEL
    ===================================================== */

    if (!channelData.items || channelData.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "MO3Z YouTube channel not found",
      });
    }

    const channel = channelData.items[0];

    const statistics = channel.statistics || {};
    const snippet = channel.snippet || {};

    /* =====================================================
       2. GET UPLOADS PLAYLIST
    ===================================================== */

    const uploadsPlaylistId =
      channel.contentDetails?.relatedPlaylists?.uploads;

    let latestVideos = [];

    if (uploadsPlaylistId) {
      const playlistUrl =
        `https://www.googleapis.com/youtube/v3/playlistItems` +
        `?part=snippet,contentDetails` +
        `&playlistId=${uploadsPlaylistId}` +
        `&maxResults=12` +
        `&key=${API_KEY}`;

      const playlistResponse = await fetch(playlistUrl);

      if (playlistResponse.ok) {
        const playlistData = await playlistResponse.json();

        /* =================================================
           GET VIDEO IDS
        ================================================= */

        const videoIds =
          playlistData.items
            ?.map(
              (item) =>
                item.contentDetails?.videoId
            )
            .filter(Boolean) || [];

        /* =================================================
           3. GET REAL YOUTUBE VIDEO STATISTICS
        ================================================= */

        if (videoIds.length > 0) {
          const videosUrl =
            `https://www.googleapis.com/youtube/v3/videos` +
            `?part=snippet,statistics,contentDetails` +
            `&id=${videoIds.join(",")}` +
            `&key=${API_KEY}`;

          const videosResponse = await fetch(videosUrl);

          if (!videosResponse.ok) {
            const errorText = await videosResponse.text();

            console.log("❌ YouTube videos API error:");
            console.log(errorText);
          } else {
            const videosData = await videosResponse.json();

            /* =================================================
               FORMAT VIDEOS
            ================================================= */

            latestVideos =
              videosData.items?.map((video) => {
                const videoStatistics =
                  video.statistics || {};

                const videoSnippet =
                  video.snippet || {};

                const videoContent =
                  video.contentDetails || {};

                return {
                  /* VIDEO ID */
                  id: video.id,

                  /* TITLE */
                  title:
                    videoSnippet.title ||
                    "Untitled Video",

                  /* DESCRIPTION */
                  description:
                    videoSnippet.description ||
                    "",

                  /* THUMBNAIL */
                  thumbnail:
                    videoSnippet.thumbnails?.high?.url ||
                    videoSnippet.thumbnails?.medium?.url ||
                    videoSnippet.thumbnails?.default?.url ||
                    "",

                  /* PUBLISHED DATE */
                  publishedAt:
                    videoSnippet.publishedAt ||
                    null,

                  /* REAL YOUTUBE VIEWS */
                  views:
                    videoStatistics.viewCount ??
                    "0",

                  /* REAL YOUTUBE COMMENTS */
                  comments:
                    videoStatistics.commentCount ??
                    "0",

                  /* DURATION */
                  duration:
                    videoContent.duration ||
                    "",

                  /* VIDEO URL */
                  url:
                    `https://www.youtube.com/watch?v=${video.id}`,

                  /* SHORTS URL */
                  shortsUrl:
                    `https://www.youtube.com/shorts/${video.id}`,
                };
              }) || [];
          }
        }
      }
    }

    /* =====================================================
       4. SEND DATA TO REACT
    ===================================================== */

    res.json({
      success: true,

      /* CHANNEL NAME */
      name:
        snippet.title ||
        "MO3Z",

      /* CHANNEL USERNAME */
      username:
        "@mo3z_roblox",

      /* CHANNEL JOIN DATE */
      joined:
        snippet.publishedAt
          ? new Date(
              snippet.publishedAt
            ).toLocaleDateString(
              "en-GB",
              {
                day: "numeric",
                month: "long",
                year: "numeric",
              }
            )
          : "25 May 2026",

      /* CHANNEL IMAGE */
      thumbnail:
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url ||
        "",

      /* SUBSCRIBERS */
      subscribers:
        statistics.subscriberCount ??
        "0",

      /* TOTAL CHANNEL VIEWS */
      totalViews:
        statistics.viewCount ??
        "0",

      /* TOTAL VIDEOS */
      videos:
        statistics.videoCount ??
        "0",

      /* LATEST VIDEOS */
      latestVideos,

      /* LAST UPDATE */
      updatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.log("❌ YouTube API error:");
    console.log(error.message);

    res.status(500).json({
      success: false,
      message: "Could not load YouTube data",
      error: error.message,
    });
  }
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log("");
  console.log("==================================");
  console.log("🔥 MO3Z SERVER STARTED");
  console.log("==================================");
  console.log(
    `🚀 Server running on port ${PORT}`
  );
  console.log(
    `📊 /api/youtube`
  );
  console.log(
    `👁️ /api/visitors`
  );
  console.log("==================================");
  console.log("");
});