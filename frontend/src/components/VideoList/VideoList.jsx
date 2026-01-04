import { useState, useEffect } from 'react';
import { videoAPI } from '../../services/api';
import VideoPlayer from '../Player/VideoPlayer';
import { useAuth } from '../../context/AuthContext';

const VideoList = ({ refresh }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [filter, setFilter] = useState('all');
  const { canEdit } = useAuth();

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      const response = await videoAPI.getVideos(params);
      setVideos(response.data.videos);
      setError('');
    } catch (err) {
      setError('Failed to load videos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [filter, refresh]);

  const handleDelete = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      await videoAPI.deleteVideo(videoId);
      setVideos(videos.filter(v => v._id !== videoId));
    } catch (err) {
      alert('Failed to delete video');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      uploading: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };
    return badges[status] || badges.processing;
  };

  const getSensitivityBadge = (status) => {
    const badges = {
      pending: 'bg-gray-100 text-gray-800',
      safe: 'bg-green-100 text-green-800',
      flagged: 'bg-red-100 text-red-800'
    };
    return badges[status] || badges.pending;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">My Videos</h2>
        
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Videos</option>
            <option value="uploading">Uploading</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-2 text-gray-600">No videos found</p>
          <p className="text-sm text-gray-500">Upload your first video to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div
              key={video._id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                {video.status === 'completed' ? (
                  <button
                    onClick={() => setSelectedVideo(video)}
                    className="text-white hover:text-blue-400 transition-colors"
                  >
                    <svg
                      className="h-16 w-16"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </button>
                ) : (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
                    <p className="text-white mt-2 text-sm">
                      {video.processingProgress}% Complete
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate">
                  {video.title}
                </h3>
                
                {video.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {video.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadge(video.status)}`}>
                    {video.status}
                  </span>
                  {video.sensitivityStatus && video.sensitivityStatus !== 'pending' && (
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getSensitivityBadge(video.sensitivityStatus)}`}>
                      {video.sensitivityStatus}
                    </span>
                  )}
                </div>

                <div className="mt-3 text-xs text-gray-500 space-y-1">
                  <div>Size: {formatFileSize(video.fileSize)}</div>
                  <div>Uploaded: {formatDate(video.createdAt)}</div>
                  {video.viewCount > 0 && <div>Views: {video.viewCount}</div>}
                </div>

                {canEdit() && (
                  <div className="mt-4 flex gap-2">
                    {video.status === 'completed' && (
                      <button
                        onClick={() => setSelectedVideo(video)}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        Play
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(video._id)}
                      className="flex-1 bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
};

export default VideoList;