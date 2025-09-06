import React, { useState, useEffect, useContext } from 'react';
import { Modal, Input, Button, List, Avatar, Checkbox, Spin, App } from 'antd';
import { LoadingOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { SettingsContext } from '@/context/settings/settings-context';
import { useAuth } from '@clerk/nextjs';
import { useFollowers, useSearchFollowers } from '@/hooks/useMessagesLayout';
import css from '@/styles/sharePostModal.module.css';

const { TextArea } = Input;

const SharePostModal = ({ 
  isOpen, 
  onClose, 
  post, 
  onSuccess 
}) => {
  const { settings } = useContext(SettingsContext);
  const isDark = settings.theme === "dark";
  const { userId } = useAuth();
  const { message } = App.useApp(); // Use App context for messages
  
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // const [filteredUsers, setFilteredUsers] = useState([]);

  // Get followers
  const { data: followersData, isLoading: isLoadingFollowers } = useFollowers(userId);
  const followers = followersData?.pages?.flatMap((p) => p.followers) || [];
  console.log('Followers data:', followers);
  const filteredUsers = useSearchFollowers(searchQuery, followers);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedUsers([]);
      setMessageText("");
      setSearchQuery("");
      setIsLoading(false);
    }
  }, [isOpen]);

  // Filter users based on search
  // useEffect(() => {
  //   if (!followers.length) return;
    
  //   const filtered = followers.filter(({ follower }) => {
  //     const fullName = `${follower.first_name || ''} ${follower.last_name || ''}`.toLowerCase();
  //     const username = (follower.username || '').toLowerCase();
  //     const search = searchQuery.toLowerCase();
      
  //     return fullName.includes(search) || username.includes(search);
  //   });
    
  //   setFilteredUsers(filtered);
  // }, [followers, searchQuery]);

  const handleUserToggle = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(({ follower }) => follower.id));
    }
  };

  const handleShare = async () => {
    if (selectedUsers.length === 0) {
      message.error('Please select at least one user to share with');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/messages/share-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: post?.id,
          recipientIds: selectedUsers,
          messageText: messageText.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        message.success(data.message);
        onSuccess?.();
        handleClose();
      } else {
        message.error(data.error || 'Failed to share post');
      }
    } catch (error) {
      console.error('Error sharing post:', error);
      message.error('Failed to share post');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setMessageText("");
    setSearchQuery("");
    onClose();
  };

  const getUserDisplayName = (user) => {
    if (!user) return 'Unknown User';
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return fullName || user.username || 'Unknown User';
  };

  // Debug log to see what post data we're receiving
  console.log('SharePostModal post data:', post);

  return (
    <Modal
      title="Share Post"
      open={isOpen}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          Cancel
        </Button>,
        <Button 
          key="share" 
          type="primary" 
          onClick={handleShare}
          loading={isLoading}
          disabled={selectedUsers.length === 0}
        >
          Share ({selectedUsers.length})
        </Button>,
      ]}
      width={600}
      className={isDark ? css.darkModal : css.lightModal}
    >
      <div className={css.container}>
        {/* Post Preview */}
        <div className={css.postPreview}>
          <h4>Post Preview:</h4>
          <div className={css.postContent}>
            <div className={css.postHeader}>
              <Avatar src={post?.author?.image_url} size={32} />
              <span className={css.authorName}>
                {getUserDisplayName(post?.author)}
              </span>
            </div>
            <div className={css.postText}>
              {post?.postText}
            </div>
            {post?.media && post?.media.length > 0 && (
              <div className={css.postMedia}>
                <span>📎 {post?.media.length} media file(s)</span>
              </div>
            )}
          </div>
        </div>

        {/* Message Input */}
        <div className={css.messageInput}>
          <TextArea
            placeholder="Add a message (optional)..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={3}
            maxLength={500}
            showCount
          />
        </div>

        {/* User Selection */}
        <div className={css.userSelection}>
          <div className={css.searchHeader}>
            <Input
              placeholder="Search users..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={css.searchInput}
            />
            <Button 
              size="small" 
              onClick={handleSelectAll}
              className={css.selectAllBtn}
            >
              {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className={css.userList}>
            {isLoadingFollowers ? (
              <div className={css.loading}>
                <Spin indicator={<LoadingOutlined spin />} size="small" /> Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className={css.noUsers}>
                No users found
              </div>
            ) : (
              <List
                dataSource={filteredUsers}
                renderItem={({ follower }) => (
                  <List.Item className={css.userItem}>
                    <Checkbox
                      checked={selectedUsers.includes(follower.id)}
                      onChange={() => handleUserToggle(follower.id)}
                    >
                      <div className={css.userInfo}>
                        <Avatar src={follower.image_url} size={32} />
                        <div className={css.userDetails}>
                          <div className={css.userName}>
                            {getUserDisplayName(follower)}
                          </div>
                          <div className={css.userUsername}>
                            @{follower.username}
                          </div>
                        </div>
                      </div>
                    </Checkbox>
                  </List.Item>
                )}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SharePostModal;