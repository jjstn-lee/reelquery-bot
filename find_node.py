import tensorflow as tf

def list_nodes(pb_path):
    with tf.io.gfile.GFile(pb_path, 'rb') as f:
        graph_def = tf.compat.v1.GraphDef()
        graph_def.ParseFromString(f.read())

        for node in graph_def.node:
            print(node.name)

list_nodes("frozen_east_text_detection.pb")