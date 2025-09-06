// components/CommentSkeleton.jsx
import React from 'react';
import { Skeleton, Flex, Avatar } from 'antd';

const CommentSkeleton = () => {
  return (
    <Flex align="flex-start" gap="middle" style={{ padding: '8px 0' }}>
      <Skeleton.Avatar active size={35} shape="circle" />
      <div style={{ width: '100%' }}>
        <Skeleton 
          active 
          title={{ width: '80%' }} 
          paragraph={{ rows: 1, width: '30%' }} 
        />
      </div>
    </Flex>
  );
};

export default CommentSkeleton;