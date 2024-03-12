const express = require('express');
const axios = require('axios');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(express.json());
app.use(bodyParser.json());

const shareHistory = [];

app.get('/share-history', (req, res) => {
  try {
    res.json(shareHistory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/submit', async (req, res) => {
  try {
    const { accessToken, url, amount, interval, deleteAfter } = req.body;
    if (!accessToken || !url || !amount || !interval || !deleteAfter) {
      throw new Error('Missing required parameters');
    }

    await share(accessToken, url, amount, interval, deleteAfter);

    res.status(200).json({ status: 200, accessToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function share(accessToken, url, amount, interval, deleteAfter) {
  try {
    const id = await getPostID(url);
    if (!id) {
      throw new Error("Unable to get link id: invalid URL, it's either a private post or visible to friends only");
    }

    const shareUrl = `https://m.facebook.com/${id}`;

    let sharedCount = 0;

    async function sharePost() {
      try {
        const response = await axios.post(
          `https://graph.facebook.com/me/feed?access_token=${accessToken}&fields=id&limit=1&published=0`,
          {
            link: shareUrl,
            privacy: { value: 'SELF' },
            no_story: true,
          },
          {
            muteHttpExceptions: true,
            headers: {
              authority: 'graph.facebook.com',
              'cache-control': 'max-age=0',
              'sec-ch-ua-mobile': '?0',
              'user-agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36',
            },
            method: 'post',
          }
        );

        sharedCount++;
        const postId = response?.data?.id;

        console.log(`Post shared: ${sharedCount}`);
        console.log(`Post ID: ${postId || 'Unknown'}`);

        if (sharedCount === amount) {
          clearInterval(timer);
          console.log('Finished sharing posts.');

          if (postId) {
            setTimeout(() => {
              deletePost(postId);
            }, deleteAfter * 1000);
          }
        }
      } catch (error) {
        console.error('Failed to share post:', error.response.data);
      }
    }

    async function deletePost(postId) {
      try {
        await axios.delete(`https://graph.facebook.com/${postId}?access_token=${accessToken}`);
        console.log(`Post deleted: ${postId}`);
      } catch (error) {
        console.error('Failed to delete post:', error.response.data);
      }
    }

    const timer = setInterval(sharePost, interval * 1000);

    setTimeout(() => {
      clearInterval(timer);
      console.log('Loop stopped.');
    }, amount * interval * 1000);

    // Add to share history
    shareHistory.push({ accessToken, url, amount, interval, deleteAfter });
  } catch (error) {
    throw new Error(`Error initiating sharing process: ${error.message}`);
  }
}

async function getPostID(url) {
  try {
    const response = await axios.post('https://id.traodoisub.com/api.php', `link=${encodeURIComponent(url)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data.id;
  } catch (error) {
    throw new Error('Failed to get post ID: ' + (error.message || 'Unknown error'));
  }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
