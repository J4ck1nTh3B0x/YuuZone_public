import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";
import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import useEventListener from "../hooks/useEventListener";

Modal.propTypes = {
  children: PropTypes.node,
  setShowModal: PropTypes.func,
  showModal: PropTypes.bool,
};

export default function Modal({ children, setShowModal, showModal }) {
  const ref = useRef();
  const contentRef = useRef();
  
  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showModal, setShowModal]);

  useEventListener(
    "click",
    (e) => {
      // Only close if clicking on the background overlay, not the content
      if (e.target === ref.current) {
        setShowModal(false);
      }
    },
    document
  );

  // Don't render if not showing
  if (!showModal) return null;

  // Use createPortal to render the modal at the document body level
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        ref={ref}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/90"
        onClick={(e) => {
          if (e.target === ref.current) {
            setShowModal(false);
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.2 }}
          ref={contentRef}
          className="w-[70%] h-[70%] max-w-[90vw] max-h-[90vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on content
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
